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

    const measure = () => {
      const bottom = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop,
      );
      document.documentElement.style.setProperty(
        "--chrome-b",
        `${Math.round(bottom)}px`,
      );
    };

    measure();
    viewport.addEventListener("resize", measure);
    viewport.addEventListener("scroll", measure);
    return () => {
      viewport.removeEventListener("resize", measure);
      viewport.removeEventListener("scroll", measure);
      document.documentElement.style.removeProperty("--chrome-b");
    };
  }, []);
}
