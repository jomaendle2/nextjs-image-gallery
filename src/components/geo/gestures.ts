import {
  HOVER_RADIUS,
  type Mark,
  markNear,
  onSphere,
  TAP_RADIUS,
} from "./marks";
import { FILL } from "./sphere";
import { clampZoom, createAim, LINE_HEIGHT, WHEEL_ZOOM } from "./zoom";

/**
 * Every way a hand can move the globe: drag, pinch, wheel, point.
 *
 * A plain function rather than a hook, and that is the point of the file. It
 * owns no React state — it is handed the same refs the frame loop reads,
 * wires six listeners onto a canvas and gives back the one function that
 * takes them off again. `GlobeCanvas` calls it from the effect that already
 * owns the loop, so there is still exactly one effect and one teardown.
 *
 * Split out because the effect had grown to hold both the render loop and the
 * whole gesture vocabulary, and the two have nothing to say to each other
 * except through the refs below.
 */

/** A `useRef` box, structurally, so nothing here has to import React. */
interface Box<T> {
  current: T;
}

/** A drag across the full width turns the globe half way round. */
const DRAG_DEGREES = 180;

/**
 * How far the globe can be tilted, in degrees of latitude either side of the
 * equator.
 *
 * Eighty rather than ninety, and it is arithmetic rather than taste. At the
 * pole `cos(phi0)` reaches zero: every meridian in the graticule collapses
 * onto a single point, and the radial push in `traceRing` — which divides by
 * the distance from the centre — is dividing by a number on its way to zero
 * for every vertex near the axis. Eighty degrees puts either pole comfortably
 * inside the disc with the arithmetic still well away from its edges.
 *
 * Clamped rather than wrapped. Past ninety the sphere turns inside out and a
 * horizontal drag reverses direction, which reads as a bug rather than as a
 * feature nobody asked for.
 */
const TILT_LIMIT = 80;

export interface GestureRefs {
  /**
   * Which pointer is currently turning the globe, or null. Shared with the
   * frame loop rather than owned here: a held globe keeps asking for frames
   * even when it has otherwise settled, and the loop is what asks.
   */
  holding: Box<number | null>;
  /** Whether the reader has taken hold of it — see `settled` in `GlobeCanvas`. */
  settled: Box<boolean>;
  /** Whether this globe is the one somebody came to use. */
  live: Box<boolean>;
  zoomed: Box<number>;
  dragged: Box<number>;
  tilted: Box<number>;
  /** Where the marks landed on the last frame painted. */
  marks: Box<Mark[]>;
  highlighted: Box<number | null>;
  reportZoom: Box<((zoom: number) => void) | undefined>;
  reportHover: Box<
    | ((chosen: { index: number; x: number; y: number } | null) => void)
    | undefined
  >;
}

/**
 * Drag to turn it, which is most of the reason this is a canvas rather than a
 * picture. The canvas is `aria-hidden` and not focusable, so this adds no
 * keyboard trap and no announced control the list does not already cover.
 * Pointer events rather than mouse, so a thumb works.
 */
export function attachGestures(
  canvas: HTMLCanvasElement,
  wake: () => void,
  refs: GestureRefs,
): () => void {
  let fromX = 0;
  let fromY = 0;

  /*
   * Every pointer currently down on the canvas. One is a drag; two is a
   * pinch. A map rather than a pair of slots because a third finger landing
   * mid-pinch must not silently replace one of the two being measured.
   */
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch: { distance: number; zoom: number } | null = null;

  const spread = (): number => {
    const [a, b] = [...pointers.values()];
    return a === undefined || b === undefined
      ? 0
      : Math.hypot(a.x - b.x, a.y - b.y);
  };

  /** The point between two fingers — what a reader is pinching *at*. */
  const midpoint = (): { x: number; y: number } | undefined => {
    const [a, b] = [...pointers.values()];
    return a === undefined || b === undefined
      ? undefined
      : onSphere(canvas, (a.x + b.x) / 2, (a.y + b.y) / 2);
  };

  /**
   * Drops the selection, because whatever is about to happen moves the mark
   * it points at.
   *
   * The card is positioned in canvas pixels against a mark that was there
   * when it was chosen. Anything that turns or magnifies the sphere leaves
   * it hanging over open ocean, pointing at a place that is now somewhere
   * else — or round the back. `GlobeStage` already did this for its two zoom
   * buttons and said so in a comment; the same argument applies word for
   * word to a drag, a wheel and a pinch, which are the three ways the sphere
   * actually moves most of the time.
   */
  const dropSelection = () => {
    if (refs.highlighted.current !== null) {
      refs.highlighted.current = null;
      refs.reportHover.current?.(null);
    }
  };

  const aim = createAim();

  const applyZoom = (next: number, at?: { x: number; y: number }) => {
    const clamped = clampZoom(next);
    if (clamped === refs.zoomed.current) {
      return;
    }

    /*
     * Turn towards whatever the reader pointed at, so magnifying arrives
     * somewhere rather than filling the porthole with the ocean that happened
     * to be in the middle. `focusedView` decides; this only applies it.
     */
    if (at !== undefined) {
      const box = canvas.getBoundingClientRect();
      const aimed = aim.towards({
        from: {
          spin: refs.dragged.current,
          tilt: refs.tilted.current,
          zoom: refs.zoomed.current,
        },
        pointer: at,
        porthole: (Math.min(box.width, box.height) / 2) * FILL,
        tiltLimit: TILT_LIMIT,
        to: clamped,
      });
      if (aimed !== null) {
        refs.dragged.current = aimed.spin;
        refs.tilted.current = aimed.tilt;
      }
    }

    refs.zoomed.current = clamped;
    dropSelection();
    refs.reportZoom.current?.(clamped);
    wake();
  };

  /*
   * Measured against the distance the gesture *started* at rather than
   * accumulated per event. Multiplying a running scale by each frame's
   * ratio compounds its own rounding, and a pinch out and back lands
   * somewhere other than where it began.
   */
  const pinchTo = (from: { distance: number; zoom: number }) => {
    const distance = spread();
    if (distance > 0 && from.distance > 0) {
      // The midpoint between the fingers is the pinch's "pointer", which is
      // what a reader is pinching *at*.
      applyZoom((from.zoom * distance) / from.distance, midpoint());
    }
  };

  /*
   * Which mark the pointer is over, against the positions the last frame
   * left behind.
   *
   * **Pointing at a mark selects it, and the selection sticks.** The
   * obvious design — show a card while the pointer is over a dot, hide it
   * when the pointer leaves — cannot work here, because the card carries
   * links to the photographs and reaching a link means moving the pointer
   * off the dot and onto the card. A card that vanishes on the way to its
   * own links is a card with no links.
   *
   * So moving over empty space changes nothing, and only three things do:
   * arriving at a different mark, pressing on empty space, and closing the
   * view. That also makes touch and mouse the same gesture rather than two
   * — a tap selects, exactly as a hover does, and the second tap lands on a
   * link.
   *
   * Reports only on change, so a sweep across the sphere costs one React
   * render per mark entered rather than one per pixel moved.
   */
  const selectAt = (event: PointerEvent, clearing: boolean) => {
    const { box, ...at } = onSphere(canvas, event.clientX, event.clientY);
    const near = markNear(
      refs.marks.current,
      at.x,
      at.y,
      event.pointerType === "mouse" ? HOVER_RADIUS : TAP_RADIUS,
    );

    if (near === null && !clearing) {
      return;
    }

    const index = near?.index ?? null;
    if (index === refs.highlighted.current) {
      return;
    }
    refs.highlighted.current = index;
    refs.reportHover.current?.(
      near === null
        ? null
        : {
            index: near.index,
            x: near.x + box.width / 2,
            y: near.y + box.height / 2,
          },
    );
    wake();
  };

  /**
   * A drag, in degrees of spin and — on the expanded globe — of tilt.
   *
   * One denominator for both axes, because the canvas is square in both
   * places it is used — `aspect-square` inline and an explicit
   * `min(96vw,74vh)` square when expanded. Equal degrees per pixel in x and y
   * is what makes a diagonal drag feel attached to the surface rather than
   * sheared.
   */
  const rotate = (event: PointerEvent) => {
    const { width } = canvas.getBoundingClientRect();
    /*
     * Divided by the zoom, because one degree covers that many more pixels
     * when magnified. Without it a drag at 2.5x throws the globe across the
     * screen and the two magnifications feel like two different controls.
     */
    const step = DRAG_DEGREES / (width || 1) / refs.zoomed.current;

    if (event.clientX !== fromX || event.clientY !== fromY) {
      dropSelection();
      // A drag moves the globe out from under the zoom's anchor, so the
      // next zoom recaptures rather than aiming at a stale place.
      aim.forget();
    }

    refs.dragged.current += (event.clientX - fromX) * step;
    /*
     * Both axes follow the finger: drag right and the surface goes right,
     * drag down and it goes down, which brings the north pole into view.
     * The alternative — moving the camera rather than the globe — inverts
     * one axis against the other and is the reason "natural scrolling" is a
     * preference rather than a default.
     */
    if (refs.live.current) {
      refs.tilted.current = Math.max(
        -TILT_LIMIT,
        Math.min(
          TILT_LIMIT,
          refs.tilted.current + (event.clientY - fromY) * step,
        ),
      );
    }

    fromX = event.clientX;
    fromY = event.clientY;
    // A held or still globe has stopped rendering; a drag has to wake it.
    wake();
  };

  const onDown = (event: PointerEvent) => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    /*
     * Touching it is what makes it yours — but only on the globe that is
     * meant to be held.
     *
     * The `live` guard is load-bearing and was missing. On `/globe` the
     * inline canvas sits inside the button that opens the overlay, so the
     * click that opens it is a `pointerdown` on the canvas: without this
     * check that click settled the inline globe permanently, and it was
     * still a frozen picture after the overlay closed. Every other
     * interactive-only behaviour here is gated the same way, and the prop's
     * own docblock promises the inline globe "behaves exactly as it always
     * has".
     */
    if (refs.live.current) {
      refs.settled.current = true;
    }

    /*
     * A press is the only thing allowed to *clear* a selection, which is
     * what makes pressing the empty ocean the way to put the card away.
     * It also selects, so a tap works where a hover cannot happen.
     */
    if (refs.live.current && pointers.size === 1) {
      selectAt(event, true);
    }

    if (pointers.size === 2 && refs.live.current) {
      // A second finger turns the drag into a pinch and stops the rotation.
      pinch = { distance: spread(), zoom: refs.zoomed.current };
      refs.holding.current = null;
      /*
       * Captured like the first one. Touch pointers get implicit capture on
       * their `pointerdown` target and would be fine without this, but a pen
       * or a second mouse-like pointer does not — released outside the canvas
       * its `pointerup` never arrives here, it never leaves `pointers`, and
       * the `pointers.size === 0` guard in `onMove` then disables hover for
       * the rest of the session.
       */
      canvas.setPointerCapture(event.pointerId);
      return;
    }

    refs.holding.current = event.pointerId;
    fromX = event.clientX;
    fromY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  };

  const onMove = (event: PointerEvent) => {
    if (pointers.has(event.pointerId)) {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    if (pinch !== null && pointers.size >= 2) {
      pinchTo(pinch);
      return;
    }

    if (refs.holding.current !== event.pointerId) {
      // Not a drag, so it is a pointer looking for something to point at.
      if (refs.live.current && pointers.size === 0) {
        selectAt(event, false);
      }
      return;
    }

    rotate(event);
  };

  const onUp = (event: PointerEvent) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) {
      pinch = null;
    } else if (pinch !== null) {
      /*
       * Two or more are still down, so the pinch continues — but not
       * necessarily between the same two fingers. `spread` measures the
       * first two in insertion order, so losing one of the original pair
       * while a third is down silently changes which pair is being measured,
       * and a baseline taken from the old pair produces a jump proportional
       * to how far apart the new one happens to be. Rebase on what is
       * actually down now, at the magnification reached so far.
       */
      pinch = { distance: spread(), zoom: refs.zoomed.current };
    }
    if (refs.holding.current === event.pointerId) {
      refs.holding.current = null;
      canvas.releasePointerCapture(event.pointerId);
    }

    /*
     * A finger lifting off a pinch leaves one still down, and that one has
     * to become the drag — otherwise the globe goes dead until everything
     * is lifted and put back.
     */
    const [remaining] = [...pointers.entries()];
    if (remaining !== undefined && pointers.size === 1) {
      const [id, at] = remaining;
      refs.holding.current = id;
      fromX = at.x;
      fromY = at.y;
    }
  };

  /*
   * Wheel and pinch both go through `applyZoom`, and both are only offered
   * to the expanded globe. `passive: false` because this calls
   * `preventDefault` — without the flag the browser assumes it will not and
   * scrolls the page as well as zooming the sphere.
   */
  const onWheel = (event: WheelEvent) => {
    if (!refs.live.current) {
      return;
    }
    event.preventDefault();
    refs.settled.current = true;
    const delta =
      event.deltaMode === 1 ? event.deltaY * LINE_HEIGHT : event.deltaY;
    // Where the pointer is, so the wheel zooms towards whatever it is over
    // rather than towards the middle of the ocean.
    applyZoom(
      refs.zoomed.current * Math.exp(-delta * WHEEL_ZOOM),
      onSphere(canvas, event.clientX, event.clientY),
    );
  };

  /*
   * A pointer arriving is enough to stop the spin, before it has clicked
   * anything. The alternative — letting hover work on a turning globe —
   * makes every mark a moving target, and the drift is fast enough to lose
   * one between deciding to point at it and arriving.
   *
   * Any pointer, not only a mouse. This used to test `pointerType`, which
   * left a pen hovering a globe that was still turning — the exact chase
   * this exists to prevent, for the one input that hovers without touching.
   * A touch pointer reaches here only together with its `pointerdown`, which
   * settles anyway, so widening it costs nothing.
   */
  const onEnter = () => {
    if (refs.live.current) {
      refs.settled.current = true;
    }
  };

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("pointerenter", onEnter);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  return () => {
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onUp);
    canvas.removeEventListener("pointerenter", onEnter);
    canvas.removeEventListener("wheel", onWheel);
  };
}
