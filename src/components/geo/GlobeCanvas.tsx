"use client";

import { useEffect, useRef, useState } from "react";
import { WORLD_LAND } from "@/lib/geo/world";
import type { GlobePoint } from "@/lib/photos/globe";
import { prefersReducedMotion } from "@/lib/prefers-reduced-motion";
import {
  drawBody,
  drawBorders,
  drawGraticule,
  drawLand,
  drawPoints,
  type View,
} from "./paint";

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

/** Fraction of the canvas the sphere fills, leaving the rim somewhere to sit. */
const FILL = 0.88;

const ALPHA_LIMB = 0.16;

/** A drag across the full width turns the globe half way round. */
const DRAG_DEGREES = 180;

/**
 * The latitude facing the camera when nothing else decides it.
 *
 * Not zero. An equator-on globe is the view nobody has ever photographed the
 * earth from — every picture of it, from Apollo to a school globe on a desk,
 * looks down on the northern hemisphere by some margin. Twenty degrees is
 * enough to read as a sphere seen from somewhere rather than as a circle.
 */
const DEFAULT_TILT = 20;

/** Polygons of rings of flat lng/lat pairs. A hole is the Caspian. */
type Land = readonly (readonly (readonly number[])[])[];
/** Open polylines. Country borders, drawn only on the expanded globe. */
type Borders = readonly (readonly number[])[];

interface Detailed {
  land: Land;
  borders: Borders;
}

/**
 * Fetches the four-times-finer coastline, once per session.
 *
 * A module-scoped promise rather than component state, so opening the globe a
 * second time is instant and two globes on one page cannot each pull it. The
 * `import()` is the whole point: nothing in the static graph names
 * `world-fine.ts`, so it is its own chunk and a reader who never expands the
 * globe never pays for it.
 */
let finePromise: Promise<Detailed> | null = null;
function loadFineLand(): Promise<Detailed> {
  finePromise ??= import("@/lib/geo/world-fine").then((module) => ({
    land: module.WORLD_LAND_FINE,
    borders: module.WORLD_BORDERS_FINE,
  }));
  return finePromise;
}

/**
 * One whole sphere, in the order the layers have to go down: body, then
 * everything that lives on the surface, then the rim.
 *
 * Split out of the frame loop because the loop's job is timing and sizing,
 * and this one's is a picture. Between them they were one function doing
 * both, which is the shape a render loop grows into if nobody stops it.
 */
function paintSphere(
  context: CanvasRenderingContext2D,
  view: View,
  ink: string,
  content: { detailed: Detailed | null; points: readonly GlobePoint[] },
): void {
  drawBody(context, view.radius, ink);

  /*
   * Everything on the surface is clipped to the disc. The limb arithmetic in
   * `paint.ts` is close rather than exact, and a hard edge is what turns
   * "close" into "a sphere".
   */
  context.save();
  context.beginPath();
  context.arc(0, 0, view.radius, 0, Math.PI * 2);
  context.clip();

  drawGraticule(context, view);
  drawLand(context, view, content.detailed?.land ?? WORLD_LAND);
  if (content.detailed !== null) {
    drawBorders(context, view, content.detailed.borders);
  }
  drawPoints(context, content.points, view);

  context.restore();

  // The rim last, so nothing paints over it.
  context.globalAlpha = ALPHA_LIMB;
  context.beginPath();
  context.arc(0, 0, view.radius, 0, Math.PI * 2);
  context.stroke();
  context.globalAlpha = 1;
}

export function GlobeCanvas({
  points,
  className = "",
  facing = null,
  detail = "coarse",
}: {
  points: readonly GlobePoint[];
  className?: string;
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
  /**
   * Turn the sphere to face this point and hold it there, instead of letting
   * it spin.
   *
   * For a globe that is about one photograph rather than about the gallery: a
   * sphere showing the Atlantic while the caption says Bali is worse than no
   * sphere. Dragging still works, because somebody who wants to see where
   * that is relative to everywhere else should be able to.
   */
  facing?: { lat: number; lng: number } | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  /*
   * Both read through refs, so the frame loop is created once and neither a
   * re-render nor a drag can restart it mid-turn.
   */
  const latest = useRef(points);
  latest.current = points;
  const dragged = useRef(0);

  const [detailed, setDetailed] = useState<Detailed | null>(null);
  useEffect(() => {
    if (detail !== "fine") {
      return;
    }
    let live = true;
    loadFineLand()
      .then((fine) => {
        if (live) {
          setDetailed(fine);
        }
      })
      .catch((cause: unknown) => {
        // The coarse coastline is already drawn, so this is a downgrade
        // rather than a failure and must not reach the error boundary.
        console.error("Could not load the detailed coastline:", cause);
      });
    return () => {
      live = false;
    };
  }, [detail]);

  const drawn = useRef(detailed);
  drawn.current = detailed;

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
    let frame = 0;
    let start: number | null = null;
    let holding: number | null = null;
    let from = 0;

    const render = (time: number) => {
      start ??= time;

      const ratio = Math.min(globalThis.devicePixelRatio || 1, 2);
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      const radius = (Math.min(width, height) / 2) * FILL;

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
       * A globe with somewhere to be does not wander. `facing` pins the
       * sphere so the mark sits in the middle of it, and the drag offset is
       * added on top so it can still be turned by hand.
       */
      const turned =
        still || facing !== null
          ? 0
          : ((time - start) / 1000) * SPIN_PER_SECOND;
      const view = {
        spin: turned + dragged.current - (facing?.lng ?? 0),
        tilt: facing?.lat ?? DEFAULT_TILT,
        radius,
      };

      paintSphere(context, view, ink, {
        detailed: drawn.current,
        points: latest.current,
      });

      /*
       * One frame and stop when the reader asked for reduced motion. Not a
       * slower spin: a globe turning slowly is still a globe turning, and the
       * setting is a request to stop rather than to be gentle about it.
       * Dragging still works, because that is motion somebody asked for.
       */
      if ((!still && facing === null) || holding !== null) {
        frame = requestAnimationFrame(render);
      }
    };

    /*
     * Drag to turn it, which is most of the reason this is a canvas rather
     * than a picture. The canvas is `aria-hidden` and not focusable, so this
     * adds no keyboard trap and no announced control the list does not
     * already cover. Pointer events rather than mouse, so a thumb works.
     */
    const wake = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(render);
    };
    const onDown = (event: PointerEvent) => {
      holding = event.pointerId;
      from = event.clientX;
      canvas.setPointerCapture(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      if (holding === event.pointerId) {
        const { width } = canvas.getBoundingClientRect();
        dragged.current +=
          ((event.clientX - from) / (width || 1)) * DRAG_DEGREES;
        from = event.clientX;
        // A held or still globe has stopped rendering; a drag has to wake it.
        wake();
      }
    };
    const onUp = (event: PointerEvent) => {
      if (holding === event.pointerId) {
        holding = null;
        canvas.releasePointerCapture(event.pointerId);
      }
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    frame = requestAnimationFrame(render);

    /*
     * A globe holding still has stopped rendering, and a canvas resized by
     * CSS keeps whatever bitmap it had — so without this, a reduced-motion
     * reader or a photograph's fixed globe would stretch into a blurred
     * ellipse the first time its column changed width. The spinning case
     * hides the bug by redrawing sixty times a second, which is exactly why
     * it would otherwise have shipped.
     */
    const observer = new ResizeObserver(wake);
    observer.observe(canvas);
    // So the effect below can ask for a frame when the fine rings land.
    repaint.current = wake;

    return () => {
      repaint.current = null;
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, [facing]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: repainting *is* the effect; `detailed` arriving is the only reason to
  useEffect(() => {
    repaint.current?.();
  }, [detailed]);

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
     */
    <canvas
      className={`block aspect-square touch-pan-y text-white ${className}`}
      ref={canvasRef}
    />
  );
}
