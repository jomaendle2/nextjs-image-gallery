"use client";

import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { prefersReducedMotion } from "@/lib/prefers-reduced-motion";

/**
 * Sub-pixel slack when comparing `scrollLeft` against its bounds. Browsers
 * report fractional scroll offsets on fractional-DPR displays, so an exact
 * comparison never reports "at the end".
 */
const EDGE_TOLERANCE = 1;

/**
 * How far off centre the active tile may sit before we bother scrolling.
 * Below this the correction is invisible and only serves to interrupt a
 * smooth scroll that is already on its way there.
 */
const CENTRED_TOLERANCE = 2;

interface DockEdges {
  /** True when there is nothing scrolled off the left-hand side. */
  atStart: boolean;
  /** True when there is nothing left to scroll to on the right. */
  atEnd: boolean;
}

interface UseDockScroll extends DockEdges {
  containerRef: RefObject<HTMLDivElement | null>;
}

/**
 * Keeps the selected thumbnail centred in the dock, and reports which edges
 * still have content behind them so the caller can fade them.
 *
 * Two decisions worth naming:
 *
 * 1. **It always centres**, rather than only acting when the active tile has
 *    fallen out of view. The visible-enough test this replaces is what made
 *    stepping through photographs feel unsteady: several presses did nothing
 *    at all, then one press jumped the strip a third of its width. Easing a
 *    little on every step is both smoother and easier to anticipate.
 *
 * 2. **The tile is found by `data-dock-index`**, not by position among the
 *    container's children. Indexing `children` couples the scroll maths to
 *    the DOM order of the scroller's contents, so adding anything inside it
 *    — a spacer, a live region — would break centring with no error.
 */
export function useDockScroll(
  currentIndex: number,
  itemCount: number,
): UseDockScroll {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  /*
   * Both true is the correct initial state: it describes a strip that does
   * not overflow, which is also what an unmeasured strip should look like.
   * Starting either at `false` would flash a fade on the first paint.
   */
  const [edges, setEdges] = useState<DockEdges>({ atStart: true, atEnd: true });

  /*
   * Rebuilt when the feed changes length, which is deliberate: adding or
   * removing photographs changes `scrollWidth` without resizing the
   * container, so neither the ResizeObserver nor the scroll listener would
   * notice on its own. A new `measure` re-runs the effect that holds it, and
   * that effect measures on the way in.
   */
  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    // An empty strip has no edges to fade, and `scrollWidth` on an empty
    // scroller would otherwise report the padding as overflow.
    if (itemCount === 0) {
      setEdges({ atStart: true, atEnd: true });
      return;
    }

    const maxScroll = container.scrollWidth - container.clientWidth;
    const next: DockEdges = {
      atStart: container.scrollLeft <= EDGE_TOLERANCE,
      atEnd: container.scrollLeft >= maxScroll - EDGE_TOLERANCE,
    };

    // Bail out of the state update when nothing changed: this runs on every
    // frame of a drag, and each `setState` would otherwise re-render the
    // whole strip mid-scroll.
    setEdges((previous) =>
      previous.atStart === next.atStart && previous.atEnd === next.atEnd
        ? previous
        : next,
    );
  }, [itemCount]);

  /*
   * Ease the active tile to the middle.
   *
   * `scrollIntoView` rather than a computed `scrollTo`: at the first and
   * last photograph the ideal centre lies outside the scrollable range, and
   * `scrollIntoView` clamps to that range instead of us asking for a
   * position the browser will silently reinterpret.
   *
   * The `requestAnimationFrame` is what makes swiping the main carousel
   * bearable. `useCarouselScroll` emits an index change per painted frame
   * while a finger is down; scheduling the scroll a frame later means each
   * new index cancels the pending frame, so exactly one smooth scroll is
   * started — once the index settles — instead of a fresh one every frame,
   * each restarting the animation from wherever the last had reached.
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const tile = container.querySelector(
        `[data-dock-index="${currentIndex}"]`,
      );
      if (!(tile instanceof HTMLElement)) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const tileRect = tile.getBoundingClientRect();
      const offset =
        tileRect.left +
        tileRect.width / 2 -
        (containerRect.left + containerRect.width / 2);

      if (Math.abs(offset) <= CENTRED_TOLERANCE) {
        return;
      }

      tile.scrollIntoView({
        behavior: prefersReducedMotion() ? "instant" : "smooth",
        block: "nearest",
        inline: "center",
      });
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [currentIndex]);

  // Watch the edges.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const handleScroll = () => {
      rafRef.current ??= requestAnimationFrame(() => {
        rafRef.current = null;
        measure();
      });
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    measure();

    return () => {
      container.removeEventListener("scroll", handleScroll);
      observer.disconnect();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [measure]);

  return { containerRef, atStart: edges.atStart, atEnd: edges.atEnd };
}
