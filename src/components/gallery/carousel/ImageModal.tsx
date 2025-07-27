"use client";

import { useEffect, useCallback, useState } from "react";
import Image from "next/image";
import { X, ZoomIn, ZoomOut } from "lucide-react";
import { GalleryImage } from "@/data/galleryData";
import { GlassButton } from "@/components/ui/glass-button";
import { ViewCount } from "@/components/gallery/ViewCount";

interface ImageModalProps {
  image: GalleryImage;
  isOpen: boolean;
  onClose: () => void;
}

export function ImageModal({ image, isOpen, onClose }: ImageModalProps) {
  const [isClosing, setIsClosing] = useState(false);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isLoaded, setIsLoaded] = useState(false);

  // Reset transform state when modal opens
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
      setIsLoaded(false);
      setIsClosing(false);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 300);
  }, [onClose]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, handleClose]);

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev * 1.5, 5));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev / 1.5, 0.5));
  };

  const handleReset = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  // Handle mouse/touch drag for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch events for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (scale > 1 && e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && scale > 1 && e.touches.length === 1) {
      e.preventDefault();
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Double tap to zoom
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (scale === 1) {
      setScale(2);
    } else {
      handleReset();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center motion-duration-300 bg-black/70 backdrop-blur-md transition-all duration-300 ${
        isClosing ? "opacity-0" : "motion-preset-expand"
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      {/* Close button */}
      <GlassButton
        onClick={handleClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full"
        aria-label="Close modal"
      >
        <X size={24} />
      </GlassButton>

      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <GlassButton
          onClick={handleZoomIn}
          className="p-2 rounded-full"
          aria-label="Zoom in"
        >
          <ZoomIn size={20} />
        </GlassButton>
        <GlassButton
          onClick={handleZoomOut}
          className="p-2 rounded-full"
          aria-label="Zoom out"
        >
          <ZoomOut size={20} />
        </GlassButton>
        <GlassButton
          onClick={handleReset}
          className="px-3 py-2 rounded-full"
          aria-label="Reset view"
        >
          Reset
        </GlassButton>
      </div>

      {/* Image Info - positioned in bottom right corner */}
      <div className="absolute bottom-4 right-4 left-4 z-10">
        <div className="backdrop-blur-md bg-black/20 rounded-2xl p-4 border border-white/10">
          <h3 className="font-semibold text-lg mb-1 text-white/95 tracking-tight">
            {image.title}
          </h3>
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm text-white/70 leading-relaxed">
              {image.description}
            </p>
            <ViewCount
              imageId={image.id}
              variant="modal"
              className="text-white/80"
              shouldIncrement={false}
            />
          </div>
        </div>
      </div>

      {/* Image container */}
      <div
        className={`relative w-full h-full flex items-center justify-center transition-transform duration-300 ${
          isClosing ? "scale-95" : "scale-100"
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
        style={{
          cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default",
        }}
      >
        <div
          className={`relative transition-all duration-300 ease-out ${
            isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
            transition: isDragging ? "none" : "transform 0.3s ease-out",
          }}
        >
          <Image
            src={image.src}
            alt={image.title}
            width={1920}
            height={1080}
            className="max-w-[90vw] max-h-[90vh] w-auto h-auto object-contain select-none"
            onLoad={() => setIsLoaded(true)}
            priority
            placeholder={image.blurDataURL ? "blur" : "empty"}
            blurDataURL={image.blurDataURL}
            sizes="90vw"
            quality={95}
            draggable={false}
          />
        </div>
      </div>

      {/* Loading indicator */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
