"use client";

import { type RefObject, useCallback, useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/prefers-reduced-motion";

/**
 * Longest we will wait for a smooth scroll to settle before committing the
 * index anyway. Only reached on engines without `scrollend`.
 */
const SCROLL_SETTLE_FALLBACK_MS = 700;

interface UseCarouselScrollOptions {
  itemCount: number;
  currentIndex: number;
  onIndexChange: (index: number) => void;
  /**
   * Beyond this many images away, animating the scroll stops being a
   * transition and becomes a blur of everything in between.
   */
  smoothScrollDistance: number;
}

interface UseCarouselScroll {
  carouselRef: RefObject<HTMLDivElement | null>;
  goToIndex: (index: number) => void;
  scrollToIndex: (index: number, behavior?: ScrollBehavior) => void;
}

/**
 * Owns every read of and write to the carousel's scroll position.
 *
 * Two things here are deliberate:
 *
 * 1. Live scroll tracking is throttled with `requestAnimationFrame` rather
 *    than a 16ms `setTimeout`. A timer fires on its own schedule and can land
 *    mid-frame, so the layout read (`scrollLeft`/`clientWidth`) happens at an
 *    arbitrary point and the resulting state update misses the frame it was
 *    meant for. rAF coalesces to exactly one read per painted frame.
 *
 * 2. Completion of a programmatic scroll is detected with the `scrollend`
 *    event instead of re-checking the position every 50ms. The old polling
 *    loop woke the main thread ~14 times per navigation to ask a question the
 *    browser can answer directly.
 */
export function useCarouselScroll({
  itemCount,
  currentIndex,
  onIndexChange,
  smoothScrollDistance,
}: UseCarouselScrollOptions): UseCarouselScroll {
  const carouselRef = useRef<HTMLDivElement>(null);
  const isTransitioningRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mirrors of the render values so the scroll callbacks can stay stable and
  // never be re-attached as the user moves through the gallery.
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;
  const onIndexChangeRef = useRef(onIndexChange);
  onIndexChangeRef.current = onIndexChange;

  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      const target = carouselRef.current?.children[index];
      if (target instanceof HTMLElement) {
        target.scrollIntoView({
          behavior,
          block: "nearest",
          inline: "center",
        });
      }
    },
    [],
  );

  const goToIndex = useCallback(
    (index: number) => {
      const carousel = carouselRef.current;
      if (
        !carousel ||
        isTransitioningRef.current ||
        index === currentIndexRef.current ||
        index < 0 ||
        index >= itemCount
      ) {
        return;
      }

      isTransitioningRef.current = true;

      /*
       * Only neighbours animate.
       *
       * Sliding from image 2 to image 10 means travelling eight viewport
       * widths, and since only the images either side of the current one
       * are mounted, most of that journey is empty placeholders flickering
       * past. Photos.app has the same split: swiping between adjacent
       * shots animates, picking a distant one from the scrubber cuts
       * straight to it. The arrival still reads as a transition because
       * the backdrop colour crossfades over 700ms and the incoming image
       * fades up as it decodes.
       */
      const distance = Math.abs(index - currentIndexRef.current);
      const jump = distance > smoothScrollDistance || prefersReducedMotion();

      scrollToIndex(index, jump ? "instant" : "smooth");

      if (jump) {
        // The reposition already happened; commit on the next frame so the
        // new index and the settled scroll position land together.
        requestAnimationFrame(() => {
          isTransitioningRef.current = false;
          onIndexChangeRef.current(index);
        });
        return;
      }

      const settle = () => {
        if (fallbackTimerRef.current) {
          clearTimeout(fallbackTimerRef.current);
          fallbackTimerRef.current = null;
        }
        carousel.removeEventListener("scrollend", settle);
        isTransitioningRef.current = false;
        /*
         * Commit where we actually ended up, not where we asked to go.
         * `scrollend` fires for any scroll on this element, so a swipe that
         * interrupts the animation resolves here too. Committing the
         * requested `index` in that case would leave the caption, indicators
         * and backdrop describing an image other than the one on screen,
         * with no further event coming to correct it.
         */
        const width = carousel.clientWidth;
        const settledIndex =
          width === 0
            ? index
            : Math.min(
                itemCount - 1,
                Math.max(0, Math.round(carousel.scrollLeft / width)),
              );
        onIndexChangeRef.current(settledIndex);
      };

      carousel.addEventListener("scrollend", settle, { once: true });
      // Safety net for engines without `scrollend`, and for the case where a
      // smooth scroll resolves to a no-op and never emits the event.
      fallbackTimerRef.current = setTimeout(settle, SCROLL_SETTLE_FALLBACK_MS);
    },
    [itemCount, scrollToIndex, smoothScrollDistance],
  );

  // Track the index while the user scrolls or swipes freely.
  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) {
      return;
    }

    const readPosition = () => {
      rafRef.current = null;
      if (isTransitioningRef.current) {
        return;
      }

      const width = carousel.clientWidth;
      if (width === 0) {
        return;
      }

      const nextIndex = Math.round(carousel.scrollLeft / width);
      if (
        nextIndex !== currentIndexRef.current &&
        nextIndex >= 0 &&
        nextIndex < itemCount
      ) {
        onIndexChangeRef.current(nextIndex);
      }
    };

    const handleScroll = () => {
      rafRef.current ??= requestAnimationFrame(readPosition);
    };

    carousel.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      carousel.removeEventListener("scroll", handleScroll);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [itemCount]);

  // Clear the settle fallback if we unmount mid-navigation.
  useEffect(
    () => () => {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
      }
    },
    [],
  );

  return { carouselRef, goToIndex, scrollToIndex };
}
