"use client";

import { X, ZoomIn, ZoomOut } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ViewCount } from "@/components/gallery/ViewCount";
import { GlassButton } from "@/components/ui/glass-button";
import type { GalleryImage } from "@/data/galleryData";
import { usePanZoom } from "./usePanZoom";

const CLOSE_ANIMATION_MS = 300;

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
      setIsLoaded(false);
      setIsClosing(false);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, CLOSE_ANIMATION_MS);
  }, [onClose]);

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
  const dragCursor = isDragging ? "grabbing" : "grab";

  return (
    <div
      aria-label={`${image.title}, full screen`}
      aria-modal="true"
      className={`fixed inset-0 z-[100] flex items-center justify-center motion-duration-300 bg-black/70 backdrop-blur-md transition-all duration-300 ${
        isClosing ? "opacity-0" : "motion-preset-expand"
      }`}
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
        className="absolute top-4 right-4 z-10 p-2 rounded-full"
        onClick={handleClose}
        ref={closeButtonRef}
      >
        <X size={24} />
      </GlassButton>

      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <GlassButton
          aria-label="Zoom in"
          className="p-2 rounded-full"
          onClick={zoomIn}
        >
          <ZoomIn size={20} />
        </GlassButton>
        <GlassButton
          aria-label="Zoom out"
          className="p-2 rounded-full"
          onClick={zoomOut}
        >
          <ZoomOut size={20} />
        </GlassButton>
        <GlassButton
          aria-label="Reset view"
          className="px-3 py-2 rounded-full"
          onClick={reset}
        >
          Reset
        </GlassButton>
      </div>

      {/* Image Info - positioned in bottom right corner */}
      <div className="absolute bottom-4 right-4 left-4 z-10">
        <div className="backdrop-blur-md mx-auto max-w-md bg-black/20 rounded-2xl p-4 border border-white/10">
          <h3 className="font-semibold text-lg mb-1 text-white/95 tracking-tight">
            {image.title}
          </h3>
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm text-white/70 leading-relaxed">
              {image.description}
            </p>
            <ViewCount
              className="text-white/80"
              imageId={image.id}
              shouldIncrement={false}
              variant="modal"
            />
          </div>
        </div>
      </div>

      {/*
        Pan surface: a drag region, not an activation target. Every action it
        offers (zoom in, zoom out, reset) is also a labelled toolbar button,
        so there is no keyboard path missing here.
      */}
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: pan gestures, mirrored by toolbar buttons */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: pan gestures, mirrored by toolbar buttons */}
      <div
        className={`relative w-full h-full flex items-center justify-center transition-transform duration-300 ${
          isClosing ? "scale-95" : "scale-100"
        }`}
        onDoubleClick={handleDoubleClick}
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          cursor: isZoomed ? dragCursor : "default",
          touchAction: isZoomed ? "none" : "auto",
        }}
      >
        <div
          className={`relative transition-opacity duration-300 ease-out ${
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
            sizes="90vw"
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
