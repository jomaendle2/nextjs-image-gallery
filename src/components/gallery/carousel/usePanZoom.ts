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

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
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
    [schedulePaint],
  );

  const handlePointerUp = useCallback((event: React.PointerEvent) => {
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
