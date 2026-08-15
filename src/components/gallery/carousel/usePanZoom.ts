"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
 * The pan offset deliberately lives in a ref and is written straight to the
 * element's `transform`, instead of living in state. Driving it through React
 * meant every `mousemove` scheduled a render of the entire modal — including
 * the toolbar, the caption and the `<Image>` — just to move one element by a
 * few pixels. Here a drag touches exactly one style property, once per frame.
 *
 * `scale` stays in state because the rest of the UI reacts to it (the cursor,
 * whether dragging is allowed at all), and it changes only on discrete steps.
 */
export function usePanZoom(isOpen: boolean) {
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<PanZoomTransform>({ x: 0, y: 0, scale: 1 });
  const dragOriginRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef<number | null>(null);

  transformRef.current.scale = scale;

  const paint = useCallback(() => {
    frameRef.current = null;
    const node = contentRef.current;
    if (!node) {
      return;
    }
    const { x, y, scale: currentScale } = transformRef.current;
    node.style.transform = `translate(${x}px, ${y}px) scale(${currentScale})`;
  }, []);

  const schedulePaint = useCallback(() => {
    frameRef.current ??= requestAnimationFrame(paint);
  }, [paint]);

  const resetTransform = useCallback(() => {
    transformRef.current = { x: 0, y: 0, scale: 1 };
    setScale(1);
    schedulePaint();
  }, [schedulePaint]);

  // Reset whenever the viewer is (re)opened.
  useEffect(() => {
    if (isOpen) {
      transformRef.current = { x: 0, y: 0, scale: 1 };
      setScale(1);
      setIsDragging(false);
    }
  }, [isOpen]);

  // Keep the painted transform in step with button-driven scale changes.
  useEffect(() => {
    schedulePaint();
  }, [schedulePaint]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    },
    [],
  );

  const zoomIn = useCallback(() => {
    setScale((prev) => {
      const next = Math.min(prev * SCALE_STEP, MAX_SCALE);
      transformRef.current.scale = next;
      schedulePaint();
      return next;
    });
  }, [schedulePaint]);

  const zoomOut = useCallback(() => {
    setScale((prev) => {
      const next = Math.max(prev / SCALE_STEP, MIN_SCALE);
      transformRef.current.scale = next;
      schedulePaint();
      return next;
    });
  }, [schedulePaint]);

  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    if (transformRef.current.scale <= 1) {
      return;
    }
    dragOriginRef.current = {
      x: event.clientX - transformRef.current.x,
      y: event.clientY - transformRef.current.y,
    };
    setIsDragging(true);
    // Keeps receiving moves even if the pointer leaves the element.
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (
        !(event.currentTarget.hasPointerCapture?.(event.pointerId) ?? false)
      ) {
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
        transformRef.current.scale = DOUBLE_CLICK_SCALE;
        setScale(DOUBLE_CLICK_SCALE);
        schedulePaint();
      } else {
        resetTransform();
      }
    },
    [resetTransform, schedulePaint],
  );

  return {
    contentRef,
    scale,
    isDragging,
    zoomIn,
    zoomOut,
    reset: resetTransform,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleDoubleClick,
  };
}
