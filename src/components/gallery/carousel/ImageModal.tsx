"use client";

import { X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { GlassButton } from "@/components/ui/glass-button";
import type { GalleryImage } from "@/data/galleryData";
import { usePanZoom } from "./usePanZoom";
import { ViewerCaption } from "./ViewerCaption";
import { ViewerControls } from "./ViewerControls";

/**
 * Must stay in step with the `viewer-*-exit` animations in globals.css: the
 * unmount happens when this elapses, so a shorter value cuts the exit off
 * mid-frame and a longer one leaves a finished, invisible overlay on screen.
 */
const CLOSE_ANIMATION_MS = 220;

interface ImageModalProps {
  image: GalleryImage;
  isOpen: boolean;
  onClose: () => void;
}

export function ImageModal({ image, isOpen, onClose }: ImageModalProps) {
  const [isClosing, setIsClosing] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
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
  } = usePanZoom(isOpen);

  useEffect(() => {
    if (isOpen) {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setIsLoaded(false);
      setIsClosing(false);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    // Held in a ref so unmounting, or reopening before the exit animation
    // finishes, cannot land a stale `setIsClosing(false)` on the next modal.
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      onClose();
      setIsClosing(false);
    }, CLOSE_ANIMATION_MS);
  }, [onClose]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    },
    [],
  );

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  // Escape to close, scroll lock, and focus handling while open.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previouslyFocusedRef.current = document.activeElement;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      // Send focus back to wherever the user left it.
      if (previouslyFocusedRef.current instanceof HTMLElement) {
        previouslyFocusedRef.current.focus();
      }
    };
  }, [isOpen, handleClose]);

  if (!isOpen) {
    return null;
  }

  const isZoomed = scale > 1;
  // Toolbar, close button and caption all arrive and leave together, behind
  // the photograph.
  const chrome = isClosing ? "viewer-chrome-exit" : "viewer-chrome-enter";
  const dragCursor = isDragging ? "grabbing" : "grab";
  /*
   * Widen the `sizes` hint as the user zooms so the browser picks a larger
   * candidate from the srcset. Without this, zooming just upscales the same
   * ~90vw bitmap: the image gets bigger but no sharper, which reads as the
   * zoom being broken. Capped at 300vw so we never request the 4K source
   * for a small step.
   */
  const zoomedSizes = `${Math.min(Math.round(90 * scale), 300)}vw`;

  return (
    <div
      aria-label={`${image.title}, full screen`}
      aria-modal="true"
      className={`fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-xl ${
        isClosing ? "viewer-backdrop-exit" : "viewer-backdrop-enter"
      }`}
      style={{
        /*
         * The gallery's colour, dimmed almost to black.
         *
         * Flat black cut the viewer off from the gallery it opened out of,
         * and turned every letterboxed edge into a hard band. Reusing the
         * image's `bgColor` at full strength is the opposite failure: the
         * backdrop stops reading as a separate mode and starts competing
         * with the photograph. A little over a third of the hue over near-black keeps
         * the room recognisably the same one, with the photo still the
         * brightest thing in it. Held under full opacity so the blurred
         * gallery stays faintly visible behind.
         */
        backgroundColor: `color-mix(in srgb, color-mix(in oklab, ${image.bgColor} 38%, oklch(7% 0 0)) 90%, transparent)`,
      }}
      role="dialog"
    >
      {/*
        The backdrop is a real button so that dismiss-on-click is an exposed
        action rather than a click handler bolted onto a <div>. It stays out
        of the tab order because Escape and the labelled close button already
        give keyboard users a way out.
      */}
      <button
        aria-label="Close full screen view"
        className="absolute inset-0 cursor-default"
        onClick={handleClose}
        tabIndex={-1}
        type="button"
      />

      {/* Close button */}
      <GlassButton
        aria-label="Close modal"
        className={`absolute top-4 right-4 z-10 p-2 rounded-full ${chrome}`}
        onClick={handleClose}
        ref={closeButtonRef}
      >
        <X size={24} />
      </GlassButton>

      <ViewerControls
        chrome={chrome}
        onReset={reset}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
      />

      <ViewerCaption chrome={chrome} image={image} />

      {/*
        Pan surface: a drag region, not an activation target. Every action it
        offers (zoom in, zoom out, reset) is also a labelled toolbar button,
        so there is no keyboard path missing here.
      */}
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: pan gestures, mirrored by toolbar buttons */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: pan gestures, mirrored by toolbar buttons */}
      <div
        className={`relative w-full h-full flex items-center justify-center ${
          isClosing ? "viewer-frame-exit" : "viewer-frame-enter"
        }`}
        onDoubleClick={handleDoubleClick}
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          cursor: isZoomed ? dragCursor : "default",
          touchAction: isZoomed ? "none" : "auto",
          // This surface spans the viewport, so while it is not being used
          // for panning it has to stay transparent to clicks, otherwise it
          // swallows every click aimed at the backdrop behind it and
          // click-outside-to-close silently does nothing. Events from the
          // image still bubble through it either way.
          pointerEvents: isZoomed ? "auto" : "none",
        }}
      >
        <div
          className={`relative pointer-events-auto transition-opacity duration-300 ease-out ${
            isLoaded ? "opacity-100" : "opacity-0"
          }`}
          ref={contentRef}
          style={{
            transition: isDragging ? "none" : "transform 0.3s ease-out",
          }}
        >
          <Image
            alt={image.title}
            className="max-w-[90vw] max-h-[90vh] w-auto h-auto object-contain select-none"
            draggable={false}
            onLoad={handleLoad}
            placeholder="blur"
            priority={true}
            quality={95}
            sizes={zoomedSizes}
            src={image.src}
          />
        </div>
      </div>

      {/* Loading indicator */}
      {isLoaded ? null : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin motion-reduce:animate-none" />
        </div>
      )}
    </div>
  );
}
