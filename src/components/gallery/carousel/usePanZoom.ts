"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

const MAX_SCALE = 5;
const MIN_SCALE = 0.5;
const SCALE_STEP = 1.5;
const DOUBLE_CLICK_SCALE = 2;

/** Separation between two pointers, in CSS pixels. */
function distanceBetween(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

interface PanZoomTransform {
  x: number;
  y: number;
  scale: number;
}

/**
 * Zoom and pan for the full-screen viewer.
 *
 * The pan offset lives in a ref and is written straight to the element's
 * `transform` rather than being held in state. Driving it through React
 * meant every pointer move scheduled a render of the entire modal, toolbar
 * and caption included, to shift one element by a few pixels.
 *
 * There are therefore two ways the transform reaches the DOM, and the split
 * matters:
 *
 *   - Discrete changes (zoom buttons, double click, reset) go through state
 *     and are painted in `useLayoutEffect`, which runs after React commits.
 *     Scheduling that write from a `requestAnimationFrame` instead races the
 *     commit, and React intermittently wins and drops the transform.
 *   - Continuous changes (dragging) cause no render at all, so nothing can
 *     overwrite them, and they are coalesced to one write per frame with rAF.
 */
export function usePanZoom(isOpen: boolean) {
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<PanZoomTransform>({ x: 0, y: 0, scale: 1 });
  const dragOriginRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef<number | null>(null);

  /*
   * Every pointer currently down, by id.
   *
   * Two of them is a pinch. This is the only way to know that: a pointer
   * event describes one finger, so the second finger's existence has to be
   * remembered between events.
   */
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  /** Finger separation and scale at the moment the pinch began. */
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);

  const paint = useCallback(() => {
    const node = contentRef.current;
    if (!node) {
      return;
    }
    const { x, y, scale: currentScale } = transformRef.current;
    node.style.transform = `translate(${x}px, ${y}px) scale(${currentScale})`;
  }, []);

  /*
   * Reassert the transform after every commit. One string write, and it
   * guarantees React can never leave a stale or missing transform behind
   * no matter what caused the render.
   */
  useLayoutEffect(paint);

  const schedulePaint = useCallback(() => {
    frameRef.current ??= requestAnimationFrame(() => {
      frameRef.current = null;
      paint();
    });
  }, [paint]);

  // Read the live scale off the ref, never off a captured `scale`, so the
  // handlers stay stable and can't act on a stale value.
  const applyScale = useCallback((next: number) => {
    transformRef.current.scale = next;
    /*
     * Dragging is only allowed above 1x, so an image that is panned off
     * centre and then zoomed back out would be stranded there with no way
     * to bring it back short of Reset. Recentre as we cross the threshold.
     */
    if (next <= 1) {
      transformRef.current.x = 0;
      transformRef.current.y = 0;
    }
    setScale(next);
  }, []);

  const reset = useCallback(() => {
    transformRef.current = { x: 0, y: 0, scale: 1 };
    setScale(1);
    // setScale is a no-op when we are already at 1, which would mean no
    // commit and no layout effect, so paint the recentred position now.
    paint();
  }, [paint]);

  // Reset whenever the viewer is (re)opened.
  useEffect(() => {
    if (isOpen) {
      transformRef.current = { x: 0, y: 0, scale: 1 };
      pointersRef.current.clear();
      pinchRef.current = null;
      setScale(1);
      setIsDragging(false);
    }
  }, [isOpen]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    },
    [],
  );

  const zoomIn = useCallback(() => {
    applyScale(Math.min(transformRef.current.scale * SCALE_STEP, MAX_SCALE));
  }, [applyScale]);

  const zoomOut = useCallback(() => {
    applyScale(Math.max(transformRef.current.scale / SCALE_STEP, MIN_SCALE));
  }, [applyScale]);

  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    /*
     * The second finger starts a pinch, and ends any drag in progress —
     * otherwise the image would slide after whichever finger happened to go
     * down first while the other was scaling it.
     */
    if (pointersRef.current.size === 2) {
      const [first, second] = [...pointersRef.current.values()];
      if (first && second) {
        pinchRef.current = {
          distance: distanceBetween(first, second),
          scale: transformRef.current.scale,
        };
      }
      setIsDragging(false);
      return;
    }

    if (transformRef.current.scale <= 1) {
      return;
    }
    dragOriginRef.current = {
      x: event.clientX - transformRef.current.x,
      y: event.clientY - transformRef.current.y,
    };
    setIsDragging(true);
    // Keeps delivering moves even if the pointer leaves the element.
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  /**
   * Scales to whatever the two fingers are now saying. Returns false when
   * this is not a pinch, so the caller can fall through to dragging.
   *
   * Scale comes from the ratio of current separation to separation at the
   * start of the gesture, against the scale the image held then — never
   * accumulated per event. Accumulation drifts, and pinching out and back in
   * would not return you to where you started.
   */
  const applyPinch = useCallback((): boolean => {
    const pinch = pinchRef.current;
    const pointers = pointersRef.current;
    if (pointers.size !== 2 || pinch === null || pinch.distance <= 0) {
      return false;
    }

    const [first, second] = [...pointers.values()];
    if (!(first && second)) {
      return false;
    }

    const ratio = distanceBetween(first, second) / pinch.distance;
    const next = Math.min(Math.max(pinch.scale * ratio, MIN_SCALE), MAX_SCALE);
    transformRef.current.scale = next;
    if (next <= 1) {
      transformRef.current.x = 0;
      transformRef.current.y = 0;
    }
    schedulePaint();
    return true;
  }, [schedulePaint]);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      const pointers = pointersRef.current;
      if (pointers.has(event.pointerId)) {
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }

      // Pinch takes precedence over drag whenever two fingers are down. The
      // scale reaches state on release rather than per frame — see
      // `handlePointerUp`, and the note about renders at the top of the file.
      if (applyPinch()) {
        return;
      }

      if (!event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        return;
      }
      if (transformRef.current.scale <= 1) {
        return;
      }
      transformRef.current.x = event.clientX - dragOriginRef.current.x;
      transformRef.current.y = event.clientY - dragOriginRef.current.y;
      schedulePaint();
    },
    [applyPinch, schedulePaint],
  );

  const handlePointerUp = useCallback((event: React.PointerEvent) => {
    const pointers = pointersRef.current;
    pointers.delete(event.pointerId);

    if (pointers.size < 2 && pinchRef.current !== null) {
      pinchRef.current = null;
      /*
       * Commit the scale reached by the pinch. Setting state per frame would
       * re-render the modal, the toolbar and the caption on every move — the
       * exact cost the ref exists to avoid — and nothing on screen depends on
       * the intermediate values.
       */
      setScale(transformRef.current.scale);
    }

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsDragging(false);
  }, []);

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      if (transformRef.current.scale === 1) {
        applyScale(DOUBLE_CLICK_SCALE);
      } else {
        reset();
      }
    },
    [applyScale, reset],
  );

  return {
    contentRef,
    scale,
    isDragging,
    zoomIn,
    zoomOut,
    reset,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleDoubleClick,
  };
}
