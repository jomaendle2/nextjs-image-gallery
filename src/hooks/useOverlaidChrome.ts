"use client";

import { useEffect } from "react";

/**
 * How much of the page's bottom edge some browser chrome is sitting on, as a
 * CSS variable.
 *
 * In-app browsers — X's is the one that surfaced this — float their bottom
 * bar *over* the page instead of shrinking the viewport for it, and they do
 * not report it in `env(safe-area-inset-bottom)` either. A `fixed inset-0`
 * layer sized by the layout viewport therefore puts its bottom row of
 * controls underneath chrome it cannot see. The one API that can see the
 * difference is `visualViewport`: its height is what is actually visible,
 * `innerHeight` is what the page was laid out against, and the shortfall is
 * the overlay.
 *
 * The measurement lands as `--chrome-b` on `<html>`, for `max()` expressions
 * beside `env(safe-area-inset-bottom)` — the `safe-chrome-b-*` utility in
 * `globals.css`. In every normal browser the two heights agree and the
 * variable is `0px`, so nothing anywhere moves. No user-agent sniffing: the
 * mechanism is measured, not guessed at.
 *
 * `offsetTop` is included because a visual viewport shortened by a *top*
 * overlay would otherwise be misread as bottom chrome. Keyboard appearance
 * also shrinks the visual viewport; that is fine here — the carousel's
 * bottom bar lifting above an open keyboard is correct behaviour, and the
 * variable returns to zero when it closes.
 */
export function useOverlaidChrome(): void {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }

    /*
     * One measurement per frame, and only written when it changes.
     *
     * `scroll` on the visual viewport fires as fast as a finger moves, and
     * `measure` reads layout (`innerHeight`, `viewport.height`) and then
     * writes a custom property — a read/write pair per event is how a smooth
     * scroll becomes a janky one. `requestAnimationFrame` collapses a burst
     * into a single measurement; the `last` check means a scroll that does
     * not change the chrome — which is most of them — writes nothing at all
     * and invalidates no style.
     */
    let frame = 0;
    let last: string | null = null;

    const measure = () => {
      frame = 0;
      /*
       * Pinched-in pages report nothing.
       *
       * `visualViewport.height` shrinks under pinch-zoom exactly as it does
       * under an overlaid bar — at 2× the difference is half a viewport, and
       * reading that as chrome threw the filmstrip and the caption up the
       * screen mid-gesture. `scale` is what tells the two apart, and it is
       * `1` in every case this hook exists for: browser chrome does not zoom
       * the page. A small tolerance because `scale` is fractional and a
       * pinch that settles back to 1 can land a hair off.
       */
      const zoomed = Math.abs(viewport.scale - 1) > 0.01;
      const bottom = zoomed
        ? 0
        : Math.max(
            0,
            window.innerHeight - viewport.height - viewport.offsetTop,
          );
      const next = `${Math.round(bottom)}px`;
      if (next !== last) {
        last = next;
        document.documentElement.style.setProperty("--chrome-b", next);
      }
    };

    const schedule = () => {
      frame ||= requestAnimationFrame(measure);
    };

    measure();
    viewport.addEventListener("resize", schedule);
    viewport.addEventListener("scroll", schedule);
    return () => {
      if (frame !== 0) {
        cancelAnimationFrame(frame);
      }
      viewport.removeEventListener("resize", schedule);
      viewport.removeEventListener("scroll", schedule);
      document.documentElement.style.removeProperty("--chrome-b");
    };
  }, []);
}
