import { onSphere } from "./marks";
import { FILL } from "./sphere";
import {
  clampZoom,
  createAim,
  LINE_HEIGHT,
  nextZoomStop,
  previousZoomStop,
  WHEEL_ZOOM,
} from "./zoom";

/**
 * Every way a hand changes the magnification: wheel, pinch, double-click.
 *
 * Split from `gestures.ts` when a double-click handler took that file past
 * the line the linter draws, which was the right moment rather than an
 * arbitrary one — the two halves had already stopped being one subject.
 * Turning and pointing are about where the globe is looking; this is about
 * how close, and it is the half with the arithmetic: a clamp, an anchored
 * aim that has to survive a run of events, and three input devices that must
 * agree on what "closer" means.
 *
 * Handed the same refs and the same `wake` as its sibling, so there is still
 * one effect and one teardown in `GlobeCanvas`. It owns exactly one thing of
 * its own — the aim — which is why it is a factory and not four functions.
 */

/** A `useRef` box, structurally, so nothing here has to import React. */
interface Box<T> {
  current: T;
}

export interface MagnifierRefs {
  live: Box<boolean>;
  settled: Box<boolean>;
  zoomed: Box<number>;
  dragged: Box<number>;
  tilted: Box<number>;
  reportZoom: Box<((zoom: number) => void) | undefined>;
}

export function createMagnifier({
  canvas,
  refs,
  tiltLimit,
  dropSelection,
  wake,
}: {
  canvas: HTMLCanvasElement;
  refs: MagnifierRefs;
  /** How far from the equator the view may lean, from the caller's own rule. */
  tiltLimit: number;
  /** Whatever the caller does about a card left hanging over moved ocean. */
  dropSelection: () => void;
  wake: () => void;
}): {
  applyZoom: (next: number, at?: { x: number; y: number }) => void;
  onWheel: (event: WheelEvent) => void;
  onDoubleClick: (event: MouseEvent) => void;
  forgetAim: () => void;
} {
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
        tiltLimit,
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

  /**
   * Double-click to magnify, at the place that was double-clicked.
   *
   * The one zoom gesture every map has and this globe did not. A reader who
   * has used any map at all arrives expecting it, tries it on a coastline,
   * and gets nothing — which reads as the globe being broken rather than as a
   * gesture being absent, because nothing about the surface says which
   * gestures it takes.
   *
   * **A stop rather than a factor.** The wheel is continuous and lands
   * wherever the reader stops turning it; a double-click is a discrete
   * decision, so it moves to the next stop exactly as `+` does. That also
   * makes the three ways of stepping the zoom agree with one another instead
   * of each having its own idea of how far "closer" is.
   *
   * `nextZoomStop` wraps back to 1 past the last stop, which is right for a
   * control that cycles and wrong here: a reader double-clicking at the
   * ceiling means "closer still", and answering with the whole earth is the
   * most surprising thing the gesture could do. `Math.max` pins it.
   *
   * **Alt or shift double-clicks out**, which is the other half of the same
   * convention, and the only way to reverse the gesture without reaching for
   * the chrome.
   *
   * The aim is recaptured rather than continued: two clicks in different
   * places are two decisions, and `forget` stops the second inheriting the
   * first one's target. `preventDefault` because a double-click on a canvas
   * otherwise selects surrounding text.
   */
  const onDoubleClick = (event: MouseEvent) => {
    if (!refs.live.current) {
      return;
    }
    event.preventDefault();
    refs.settled.current = true;
    aim.forget();

    const out = event.altKey || event.shiftKey;
    const from = refs.zoomed.current;
    const to = out
      ? previousZoomStop(from)
      : Math.max(from, nextZoomStop(from));

    applyZoom(to, onSphere(canvas, event.clientX, event.clientY));
  };

  return { applyZoom, forgetAim: aim.forget, onDoubleClick, onWheel };
}
