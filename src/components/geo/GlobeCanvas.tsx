"use client";

import { useEffect, useRef, useState } from "react";
import type { GlobePoint } from "@/lib/photos/globe";
import { prefersReducedMotion } from "@/lib/prefers-reduced-motion";
import { loadCoarseLand, loadFineLand, loadFinestLand } from "./coastline";
import type { GestureRefs } from "./gestures";
import type { Mark } from "./marks";
import { placeMarks } from "./marks";
import { simpleDrag } from "./simple-drag";
import { type Detailed, FILL, type Land, paintSphere } from "./sphere";
import { drawRatio, fitSurface, trackBox } from "./surface";
import { FINEST_FROM } from "./zoom";

/**
 * The globe, as an enhancement over the list that is already on the page.
 *
 * No dependency at all. Rejected, and why: `cobe` (~28 KB, and a look that
 * introduces colour this design system has no token for), `globe.gl` (pulls
 * three.js, ~600 KB), `d3-geo` (~28 KB, genuinely good — worth adding only
 * if this ever needs projections in the plural).
 *
 * The first version drew unfilled coastlines on an almost invisible disc and
 * read as a wireframe somebody had abandoned. Everything that fixes that is
 * in `paint.ts` and all of it is about the sphere being an object rather than
 * a circle with a pattern on it: filled land, a body lit from one side, a
 * graticule, a rim.
 *
 * This file is the lifecycle — device pixel ratio, the frame loop, the
 * pointer. Colour is one Tailwind class on the canvas read back with
 * `getComputedStyle`, and the painting varies nothing but alpha; a canvas
 * cannot read a class, and assigning a hex literal to `fillStyle` is exactly
 * what `design.test.ts` forbids. (That test reads raw source, comments
 * included, which is why this describes the literal rather than showing one.)
 */

/** Degrees turned per second. Slow enough to read, fast enough to notice. */
const SPIN_PER_SECOND = 3.2;

/**
 * The latitude facing the camera.
 *
 * Not zero. An equator-on globe is the view nobody has ever photographed the
 * earth from — every picture of it, from Apollo to a school globe on a desk,
 * looks down on the northern hemisphere by some margin. Twenty degrees is
 * enough to read as a sphere seen from somewhere rather than as a circle.
 */
const DEFAULT_TILT = 20;

interface GlobeCanvasProps {
  points: readonly GlobePoint[];
  className?: string;
  /**
   * Whether this globe is the one somebody came to use.
   *
   * The inline globe on `/globe` passes nothing and behaves exactly as it
   * always has: it turns slowly, a horizontal drag nudges it, and a vertical
   * swipe scrolls the page past it. The expanded globe is the instrument —
   * it tilts, it stops turning once it is yours, and it takes the vertical
   * axis away from the page.
   *
   * One prop rather than two components because the difference is entirely
   * in the event handling; the sphere is the same sphere, and a second copy
   * of `paintSphere` is how the two would drift apart.
   */
  interactive?: boolean;
  /**
   * How much the sphere is magnified. Owned by the caller, because the zoom
   * buttons live in the chrome around the canvas and the coastline the caller
   * hands down depends on it.
   */
  zoom?: number;
  /** A wheel or a pinch, reported back so the buttons and the caller agree. */
  onZoomChange?: (zoom: number) => void;
  /**
   * Which mark is selected, and where it is, in CSS pixels from the canvas's
   * top-left corner — which is the coordinate space the card sitting over the
   * canvas is positioned in. `null` when a press cleared the selection.
   */
  onHover?: (chosen: { index: number; x: number; y: number } | null) => void;
  /**
   * The full gesture vocabulary — tilt, pinch, wheel, hit testing — handed in
   * rather than imported.
   *
   * This looks like indirection for its own sake and is not: it is what keeps
   * `gestures.ts`, `zoom.ts` and the hover card out of `/globe`'s JavaScript.
   * Every visitor to that page renders the inline globe, and almost none of
   * them open the expanded one; a static import here would put the whole
   * interaction in the page's bundle for the benefit of the few who click.
   * `GlobeOverlay` is loaded on that click and passes `attachGestures` in.
   *
   * Without it the canvas keeps the modest drag it has always had — one
   * pointer, horizontal only, no zoom and no marks to point at. That is
   * exactly what the inline globe did before any of this, and it is twenty
   * lines rather than three hundred.
   */
  attach?: (
    canvas: HTMLCanvasElement,
    wake: () => void,
    refs: GestureRefs,
  ) => () => void;
  /**
   * Bumped by the caller to put the globe back the way it opened.
   *
   * A counter rather than a pair of angles, because the angles live in refs
   * here — the frame loop reads them sixty times a second, and holding them in
   * React state would restart the loop on every drag. A number that only ever
   * changes is the smallest thing that can cross the boundary without moving
   * the ownership.
   */
  resetCount?: number;
  /**
   * `"fine"` swaps in a coastline several times finer and adds country
   * borders, fetched on mount rather than bundled.
   *
   * Only worth it above roughly 600px across: below that the extra vertices
   * land inside a pixel, and borders over a small coastline are noise. The
   * everyday set draws in the meantime, so the sphere is never blank and the
   * swap is the only thing that happens.
   */
  detail?: "coarse" | "fine";
}

export function GlobeCanvas({
  points,
  className = "",
  detail = "coarse",
  interactive = false,
  zoom = 1,
  onZoomChange,
  onHover,
  attach,
  resetCount = 0,
}: GlobeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  /*
   * Both read through refs, so the frame loop is created once and neither a
   * re-render nor a drag can restart it mid-turn.
   */
  const latest = useRef(points);
  latest.current = points;
  const dragged = useRef(0);
  const tilted = useRef(DEFAULT_TILT);

  /*
   * Whether the reader has taken hold of the globe, and therefore whether it
   * is still allowed to turn on its own.
   *
   * A globe that keeps drifting under a pointer is not an instrument, it is
   * a moving target: a mark travelling at `SPIN_PER_SECOND` crosses its own
   * halo in about three seconds, so anything hover-driven would be a chase.
   * Stopping on first contact is what makes the rest of the expanded view
   * possible, and it is also where nearly all of the frame budget comes
   * from — a settled globe requests no frames at all.
   *
   * This unifies with the reduced-motion path rather than sitting beside it:
   * a reader who asked for no motion simply starts out settled.
   */
  const settled = useRef(false);

  /*
   * Kept as a ref for the same reason as everything else here: the frame loop
   * is built once, and a prop change must not restart it mid-turn.
   */
  const live = useRef(interactive);
  live.current = interactive;
  const zoomed = useRef(zoom);
  zoomed.current = zoom;

  /*
   * Callbacks through refs for the same reason as everything else: the frame
   * loop and the listeners are built once, and a parent re-rendering with a
   * fresh closure must not tear them down and rebuild them mid-gesture.
   */
  const reportZoom = useRef(onZoomChange);
  reportZoom.current = onZoomChange;
  const reportHover = useRef(onHover);
  reportHover.current = onHover;
  const wire = useRef(attach);
  wire.current = attach;

  /*
   * Where the marks landed on the last frame painted, which is what the
   * pointer is tested against. Safe to read between frames only because an
   * interactive globe has settled — see `settled` above and the note on
   * `placeMarks`.
   */
  const marks = useRef<Mark[]>([]);
  const highlighted = useRef<number | null>(null);

  /*
   * The everyday coastline, on mount and unconditionally — every globe draws
   * it, and the `detail === "fine"` ones draw it until their own set lands.
   */
  const [coarse, setCoarse] = useState<Land | null>(null);
  useEffect(() => {
    let alive = true;
    loadCoarseLand()
      .then((land) => {
        if (alive) {
          setCoarse(land);
        }
      })
      .catch((cause: unknown) => {
        // A globe with no coastline is a worse globe, not a broken page: the
        // list of links beside it is the content and is already rendered.
        console.error("Could not load the coastline:", cause);
      });
    return () => {
      alive = false;
    };
  }, []);

  const [detailed, setDetailed] = useState<Detailed | null>(null);
  useEffect(() => {
    if (detail !== "fine") {
      return;
    }
    let alive = true;
    loadFineLand()
      .then((fine) => {
        if (alive) {
          setDetailed(fine);
        }
      })
      .catch((cause: unknown) => {
        // The coarse coastline is already drawn, so this is a downgrade
        // rather than a failure and must not reach the error boundary.
        console.error("Could not load the detailed coastline:", cause);
      });
    return () => {
      alive = false;
    };
  }, [detail]);

  /*
   * The deep coastline replaces the fine one once it lands, and is asked for
   * only when the reader has zoomed past what the fine one can draw.
   *
   * `deep` rather than a second slot in `detailed`: `paintSphere` wants one
   * set of land and one set of borders, and choosing between them here keeps
   * the painter from learning that there are tiers at all.
   */
  const [deep, setDeep] = useState<Detailed | null>(null);
  const wantsDeep = detail === "fine" && zoom >= FINEST_FROM;
  useEffect(() => {
    if (!wantsDeep) {
      return;
    }
    let alive = true;
    loadFinestLand()
      .then((finest) => {
        if (alive) {
          setDeep(finest);
        }
      })
      .catch((cause: unknown) => {
        /*
         * A downgrade, not a failure — the fine coastline is already on
         * screen and stays there. The reader gets a softer picture at high
         * zoom rather than an error, which is the right trade for half a
         * megabyte that may simply not have arrived.
         */
        console.error("Could not load the deep coastline:", cause);
      });
    return () => {
      alive = false;
    };
  }, [wantsDeep]);

  /*
   * And it is handed back when the reader zooms out again — `wantsDeep`, not
   * merely `deep`, decides which one is painted.
   *
   * Keeping it once it had landed cost nothing at high zoom, where most of it
   * is culled, and a great deal at 1x, where nothing is: `outsideFrame` culls
   * nothing while the radius equals the frame, so the whole finest coastline
   * — some five times the vertices of the fine one — was being projected on
   * every frame of a drag, on the machines least able to afford it. The tier
   * is a function of the zoom, not of what has been downloaded.
   */
  const painted = wantsDeep ? (deep ?? detailed) : detailed;
  const drawn = useRef(painted);
  drawn.current = painted;
  const drawnCoarse = useRef(coarse);
  drawnCoarse.current = coarse;

  /*
   * The rings arrive after the first frame, and a globe holding still has
   * stopped rendering by then — so the swap has to ask for one more frame.
   * Set by the effect that owns the loop, cleared when it tears down.
   */
  const repaint = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas === null || !context) {
      return;
    }

    const ink = globalThis.getComputedStyle(canvas).color;
    const still = prefersReducedMotion();
    settled.current = still;
    let frame = 0;
    let start: number | null = null;
    /*
     * Which pointer is turning the globe. A box rather than a `let`, because
     * `attachGestures` writes it and the loop below reads it — a held globe
     * keeps asking for frames even after it has otherwise settled.
     */
    const holding: { current: number | null } = { current: null };
    let spun = 0;

    /* Measured when the box changes, not per frame. See `trackBox`. */
    const { size, remeasure } = trackBox(canvas);

    const render = (time: number) => {
      start ??= time;

      const ratio = drawRatio(globalThis.devicePixelRatio);
      const { width, height } = size;
      fitSurface(canvas, width, height, ratio);
      /*
       * Two radii, and the whole of the zoom is the gap between them. `frame`
       * is the circle the picture is cut to and never changes with zoom, so
       * magnifying does not grow the globe's footprint on the page — it fills
       * the same porthole with more sphere.
       */
      const porthole = (Math.min(width, height) / 2) * FILL;
      const radius = porthole * zoomed.current;

      /*
       * Resizing a canvas resets its context, so every piece of state here is
       * re-established rather than adjusted. `setTransform` puts the origin at
       * the centre, which is where a sphere wants it.
       */
      context.setTransform(
        ratio,
        0,
        0,
        ratio,
        (width / 2) * ratio,
        (height / 2) * ratio,
      );
      context.clearRect(-width, -height, width * 2, height * 2);
      context.strokeStyle = ink;
      context.fillStyle = ink;
      context.lineWidth = 1;
      context.lineJoin = "round";

      /*
       * The drag offset is added on top of the spin rather than replacing it,
       * so turning the sphere by hand moves where it is rather than stopping
       * it being a globe that turns.
       */
      const turned =
        still || settled.current
          ? spun
          : ((time - start) / 1000) * SPIN_PER_SECOND;
      /*
       * The spin is frozen at the value it had reached rather than reset, so
       * taking hold of the globe stops it where it is instead of snapping it
       * back to the Gulf of Guinea.
       */
      spun = turned;
      const view = {
        spin: turned + dragged.current,
        tilt: tilted.current,
        radius,
      };

      marks.current = placeMarks(latest.current, view);

      paintSphere(context, view, ink, {
        detailed: drawn.current,
        coarse: drawnCoarse.current,
        marks: marks.current,
        frame: porthole,
        highlighted: highlighted.current,
      });

      /*
       * One frame and stop when the reader asked for reduced motion. Not a
       * slower spin: a globe turning slowly is still a globe turning, and the
       * setting is a request to stop rather than to be gentle about it.
       * Dragging still works, because that is motion somebody asked for.
       */
      if (!(still || settled.current) || holding.current !== null) {
        frame = requestAnimationFrame(render);
      }
    };

    const wake = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(render);
    };

    const detach =
      wire.current?.(canvas, wake, {
        holding,
        settled,
        live,
        zoomed,
        dragged,
        tilted,
        marks,
        highlighted,
        reportZoom,
        reportHover,
      }) ?? simpleDrag(canvas, wake, { holding, dragged });
    frame = requestAnimationFrame(render);

    /*
     * A globe holding still has stopped rendering, and a canvas resized by
     * CSS keeps whatever bitmap it had — so without this, a reduced-motion
     * reader's globe would stretch into a blurred ellipse the first time its
     * column changed width. The spinning case hides the bug by redrawing
     * sixty times a second, which is exactly why it would otherwise have
     * shipped.
     */
    const observer = new ResizeObserver(() => {
      remeasure();
      wake();
    });
    observer.observe(canvas);
    // So the effect below can ask for a frame when the fine rings land.
    repaint.current = wake;

    return () => {
      repaint.current = null;
      cancelAnimationFrame(frame);
      observer.disconnect();
      detach();
    };
  }, []);

  /*
   * Both coastlines land after the first frame, and a globe holding still —
   * or one that has finished its reduced-motion single frame — has stopped
   * rendering by then. Either arriving has to ask for one more frame, which
   * is why both are listed.
   *
   * `zoom` is here for the same reason and one more: the wheel and the pinch
   * repaint themselves, but the zoom buttons change the prop from outside and
   * nothing else would notice.
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: repainting *is* the effect; a coastline or a zoom arriving is the only reason to
  useEffect(() => {
    repaint.current?.();
  }, [detailed, deep, coarse, zoom]);

  /*
   * Face the way it did when it opened.
   *
   * Skipped on mount — `resetCount` starts at zero and the globe is already
   * where it should be, so running this then would only cost a frame. After
   * that, each bump puts the two angles back and asks for one repaint.
   *
   * `settled` is deliberately left alone: somebody who has taken hold of the
   * globe and pressed reset wants it facing forward again, not spinning away
   * from them.
   */
  const resetsSeen = useRef(resetCount);
  /* The counter is the whole trigger; the refs it writes are not reactive. */
  useEffect(() => {
    if (resetsSeen.current === resetCount) {
      return;
    }
    resetsSeen.current = resetCount;
    dragged.current = 0;
    tilted.current = DEFAULT_TILT;
    repaint.current?.();
  }, [resetCount]);

  return (
    /*
     * No label, and no fallback content inside it. A canvas with no children
     * is nothing to a screen reader, which is right here: the grouped list
     * beside it is the same information, complete, in a form that can be read
     * out. A description saying "a globe with eleven dots on it" would be a
     * worse version of the list, announced first.
     *
     * `touch-pan-y` so a drag turns the globe while a swipe still scrolls the
     * page — on a phone the page has to win the vertical axis.
     *
     * The expanded globe takes that axis back with `touch-none`, and it is
     * the only place that is safe: Radix has already locked the body scroll
     * behind the dialog, so there is no page scrolling left to steal. Getting
     * this the wrong way round on the inline globe would trap a thumb on
     * `/globe` — a reader would swipe up and the page would sit there.
     */
    <canvas
      className={`block aspect-square ${interactive ? "touch-none" : "touch-pan-y"} text-(--globe-ink) ${className}`}
      ref={canvasRef}
    />
  );
}
