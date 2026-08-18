"use client";

import { type RefObject, useCallback, useRef } from "react";

/**
 * Swipe-down-to-dismiss, in the two ways people perform it.
 *
 * A slow, deliberate drag is judged on distance; a flick is over before it
 * has travelled far, so it is judged on speed. Wanting both is why there are
 * two thresholds rather than one. The distance is a little under an eighth of
 * a phone's height — far enough that a shaky tap cannot reach it, near enough
 * that the gesture never feels like work.
 */
const DISMISS_DISTANCE_PX = 96;
const DISMISS_FLICK_VELOCITY = 0.6;
const DISMISS_FLICK_DISTANCE_PX = 24;

/**
 * How much more vertical than horizontal the first movement has to be before
 * the gesture is treated as a dismissal. Without it, every diagonal drag
 * across the photograph would start dragging the viewer off the bottom of the
 * screen — and this is the axis the site will want for paging, once the
 * viewer has anything to page to.
 */
const DISMISS_AXIS_RATIO = 1.4;

/** Movement below this is a tap that missed, not a gesture. */
const GESTURE_SLOP_PX = 8;

/** How long the viewer takes to ride back after a swipe that fell short. */
const SPRING_BACK_MS = 220;

interface Swipe {
  pointerId: number;
  x: number;
  y: number;
  time: number;
  /** Set once the gesture has been judged a dismissal rather than a tap. */
  tracking: boolean;
}

/**
 * Dismissing the full-screen viewer by swiping it downwards.
 *
 * The viewer used to have exactly one way out on a phone: the 48px X in the
 * corner. No swipe in any direction did anything — and on a photo viewer, a
 * downward swipe is the gesture every visitor already has in their hands
 * before they arrive.
 *
 * The handlers are meant for the dialog element itself rather than for the
 * pan surface inside it. At 1x that surface is `pointer-events: none` — it
 * has to be, or it would swallow every click meant for the backdrop — so a
 * touch that starts anywhere but on the photograph never reaches it.
 * Everything bubbles to the dialog.
 *
 * The offset is written straight to the node, exactly as `usePanZoom` writes
 * the pan transform and for the same reason: a state update per frame would
 * re-render the modal, the toolbar and the caption in order to move one
 * element. The viewer's exit animation touches only opacity, so a dismissed
 * viewer keeps whatever offset the finger left it at and fades from there.
 *
 * Touch and pen only. On a mouse this would turn dragging the backdrop into
 * a close, which is not what dragging means on a desktop.
 */
export function useSwipeDismiss({
  surfaceRef,
  isZoomed,
  onDismiss,
}: {
  /** The element that moves with the finger — the dialog. */
  surfaceRef: RefObject<HTMLElement | null>;
  /** While zoomed, a downward drag is a pan; the viewer must not take it. */
  isZoomed: boolean;
  onDismiss: () => void;
}) {
  const swipeRef = useRef<Swipe | null>(null);
  /** Set by a gesture, read by the click the browser synthesises after it. */
  const swipedRef = useRef(false);

  const setOffset = useCallback(
    (offset: number | null) => {
      const surface = surfaceRef.current;
      if (!surface) {
        return;
      }
      if (offset === null) {
        // Released short of the threshold: ride back to where it started.
        surface.style.transition = `transform ${SPRING_BACK_MS}ms var(--ease-glass)`;
        surface.style.transform = "";
        return;
      }
      surface.style.transition = "none";
      surface.style.transform = `translateY(${offset}px)`;
    },
    [surfaceRef],
  );

  const onPointerCancel = useCallback(() => {
    const swipe = swipeRef.current;
    swipeRef.current = null;
    if (swipe?.tracking) {
      // A cancelled gesture is not a decision, whatever distance it covered.
      setOffset(null);
    }
  }, [setOffset]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      swipedRef.current = false;
      /*
       * A second finger is a pinch, never a dismissal. Abandon whatever the
       * first one was doing and put the viewer back, or the offset it had
       * reached would stay on screen underneath the zoom.
       */
      if (swipeRef.current !== null) {
        onPointerCancel();
        return;
      }
      if (event.pointerType === "mouse" || isZoomed) {
        return;
      }
      swipeRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        time: event.timeStamp,
        tracking: false,
      };
    },
    [isZoomed, onPointerCancel],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const swipe = swipeRef.current;
      if (swipe === null || swipe.pointerId !== event.pointerId) {
        return;
      }
      const dx = event.clientX - swipe.x;
      const dy = event.clientY - swipe.y;

      if (!swipe.tracking) {
        if (Math.hypot(dx, dy) < GESTURE_SLOP_PX) {
          return;
        }
        /*
         * The first real movement decides what the gesture is, once and for
         * the rest of it. Judging per event instead would let a drag that
         * wandered downwards halfway through start dragging the viewer.
         */
        if (dy <= 0 || dy < Math.abs(dx) * DISMISS_AXIS_RATIO) {
          swipeRef.current = null;
          return;
        }
        swipe.tracking = true;
        swipedRef.current = true;
      }

      setOffset(Math.max(0, dy));
    },
    [setOffset],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent) => {
      const swipe = swipeRef.current;
      swipeRef.current = null;
      if (swipe === null || !swipe.tracking) {
        return;
      }

      const dy = event.clientY - swipe.y;
      // Guard the divisor: two events can carry the same timestamp.
      const velocity = dy / Math.max(event.timeStamp - swipe.time, 1);
      if (
        dy > DISMISS_DISTANCE_PX ||
        (dy > DISMISS_FLICK_DISTANCE_PX && velocity > DISMISS_FLICK_VELOCITY)
      ) {
        onDismiss();
        return;
      }
      setOffset(null);
    },
    [onDismiss, setOffset],
  );

  /**
   * Whether the click now being handled is the tail of a swipe, clearing the
   * flag as it answers.
   *
   * A swipe that ended short of the threshold has just sprung the viewer
   * back, and the browser then delivers a click on whatever was under the
   * finger — which on the backdrop means close. Without this the spring-back
   * would be an animation played over a viewer that was closing anyway, and
   * no swipe would ever be recoverable.
   */
  const consumeSwipe = useCallback(() => {
    const swiped = swipedRef.current;
    swipedRef.current = false;
    return swiped;
  }, []);

  return {
    consumeSwipe,
    onPointerCancel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
}
