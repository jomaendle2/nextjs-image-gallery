"use client";

import { X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { GlassButton } from "@/components/ui/glass-button";
import type { GalleryImage } from "@/data/galleryData";
import { photoAltText } from "@/lib/photos/alt-text";
import { trapTab } from "./focus-trap";
import { usePanZoom } from "./usePanZoom";
import { useSwipeDismiss } from "./useSwipeDismiss";
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
  onClose: () => void;
}

export function ImageModal({ image, onClose }: ImageModalProps) {
  const [isClosing, setIsClosing] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
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
  } = usePanZoom();

  const handleClose = useCallback(() => {
    // A close already under way owns the exit. Without this, a swipe that
    // dismisses and the click the browser synthesises after it would each
    // start a timer, and the second would call `onClose` again after the
    // modal had already gone.
    if (closeTimerRef.current) {
      return;
    }
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

  const isZoomed = scale > 1;
  const swipe = useSwipeDismiss({
    isZoomed,
    onDismiss: handleClose,
    surfaceRef: dialogRef,
  });

  const handleBackdropClick = useCallback(() => {
    if (swipe.consumeSwipe()) {
      return;
    }
    handleClose();
  }, [handleClose, swipe.consumeSwipe]);

  /*
   * Escape to close, scroll lock, and focus handling.
   *
   * Runs once, because the modal is mounted only while it is open — so
   * "what had focus before" is a local rather than a ref that has to
   * survive re-renders.
   */
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }

      const dialog = dialogRef.current;
      if (dialog && trapTab(dialog, event)) {
        event.preventDefault();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      // Send focus back to wherever the user left it.
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, [handleClose]);

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
   *
   * 100 rather than 90 since the image lost its margin on small screens; the
   * hint may overshoot the desktop layout by a tenth, which costs at most one
   * srcset step and never the other way round.
   */
  const zoomedSizes = `${Math.min(Math.round(100 * scale), 300)}vw`;

  return (
    <div
      aria-label={`${image.title}, full screen`}
      aria-modal="true"
      className={`fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-xl ${
        isClosing ? "viewer-backdrop-exit" : "viewer-backdrop-enter"
      }`}
      onPointerCancel={swipe.onPointerCancel}
      onPointerDown={swipe.onPointerDown}
      onPointerMove={swipe.onPointerMove}
      onPointerUp={swipe.onPointerUp}
      style={{
        /*
         * Vertical drags have to reach the handlers above rather than being
         * claimed by the browser, so `pan-y` cannot be on the list. What the
         * browser keeps is `pinch-zoom`: the viewer's own zoom is a feature,
         * not a replacement for the one a visitor uses because they need to.
         * While zoomed the whole surface belongs to the pan gesture.
         */
        touchAction: isZoomed ? "none" : "pinch-zoom",
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
      ref={dialogRef}
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
        onClick={handleBackdropClick}
        tabIndex={-1}
        type="button"
      />

      {/*
        Close button.

        The inset lives on this wrapper rather than on the button: `safe-t-4`
        is padding, and padding on a `size="icon"` button is the thing that
        makes it 44px. See `ViewerControls`, which pins its cluster to the
        opposite corner the same way.
      */}
      <div className="pointer-events-none absolute top-0 right-0 z-10 safe-x-4 safe-t-4">
        <GlassButton
          aria-label="Close full screen view"
          /*
            `size="icon"` rather than `p-2`. `cn` is twMerge, so a padding
            utility in `className` overrides the variant's own — which made
            the close button of the full-screen viewer 40px wide, under the
            44px floor this codebase documents and checks everywhere else.
          */
          className={`pointer-events-auto ${chrome}`}
          onClick={handleClose}
          ref={closeButtonRef}
          size="icon"
        >
          <X size={24} />
        </GlassButton>
      </div>

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
            /*
             * The photograph itself never hands its touches to the browser.
             *
             * Pinch has to start at 1×, and a two-finger gesture on an
             * element with the default touch-action is claimed by the
             * browser for page zoom before a single `pointermove` is
             * delivered — so the viewer would never see the gesture it is
             * now able to handle. Only the image is claimed this way; the
             * backdrop around it still behaves normally.
             */
            touchAction: "none",
          }}
        >
          <Image
            alt={photoAltText(image)}
            /*
             * `dvh`, not `vh`: on iOS Safari `vh` resolves against the
             * *large* viewport, the one that exists only once the URL bar
             * has scrolled away, so 90vh reaches under browser chrome that
             * is still on screen. The dynamic unit is what the rest of the
             * codebase uses.
             *
             * Full width below `sm`, 90% above it. The 10% margin is a
             * desktop manner — it separates the photograph from the edge of
             * a large screen. On a portrait phone it was buying nothing: the
             * carousel behind renders this same photograph at 342px and the
             * viewer at 351px, so "full screen" was a 2.6% enlargement that
             * cost a fresh download. The margin is where the difference was.
             */
            className="max-w-[100vw] max-h-[90dvh] sm:max-w-[90vw] w-auto h-auto object-contain select-none"
            draggable={false}
            onLoad={handleLoad}
            placeholder="blur"
            /*
             * Eager and high priority, but not preloaded. The modal mounts on
             * a click, so a `<link rel=preload>` in the head would be injected
             * after the request it is supposed to get ahead of — `priority`
             * (deprecated in Next 16, and a `preload` alias) bought nothing
             * here except a late tag. What matters for a full-screen
             * photograph the reader is already waiting on is its place in the
             * queue, which is what `fetchPriority` sets.
             */
            fetchPriority="high"
            loading="eager"
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
