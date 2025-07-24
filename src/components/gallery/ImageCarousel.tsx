"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { CarouselImage } from "./carousel/CarouselImage";
import { CarouselNavigation } from "./carousel/CarouselNavigation";
import { CarouselTopBar } from "./carousel/CarouselTopBar";
import { ImageIndicators } from "./carousel/ImageIndicators";
import { ImageInfo } from "./carousel/ImageInfo";
import { galleryImages } from "@/data/galleryData";
import { useCarouselKeyboard } from "./carousel/useCarouselKeyboard";
import { useImageColor } from "./carousel/useImageColor";

interface ImageCarouselProps {
  initialIndex?: number;
  currentIndex?: number;
  onIndexChange?: (index: number) => void;
  onClose?: () => void;
}

export function ImageCarousel({
  initialIndex = 0,
  currentIndex: externalCurrentIndex,
  onIndexChange,
  onClose,
}: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(
    externalCurrentIndex ?? initialIndex,
  );
  const [isTransitioning, setIsTransitioning] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentImageRef = useRef<HTMLImageElement>(null);

  // Get the current image data
  const currentImage = galleryImages[currentIndex];

  // Use the image color hook
  const { dominantColor } = useImageColor(
    currentImageRef,
    currentImage.id,
    currentIndex,
  );

  // Sync external currentIndex with internal state
  useEffect(() => {
    if (
      externalCurrentIndex !== undefined &&
      externalCurrentIndex !== currentIndex
    ) {
      setCurrentIndex(externalCurrentIndex);
      scrollToImage(externalCurrentIndex);
    }
  }, [externalCurrentIndex, currentIndex]);

  // Handle keyboard navigation
  useCarouselKeyboard({
    onNext: () => goToNext(),
    onPrevious: () => goToPrevious(),
    onClose: onClose,
  });

  const updateCurrentIndex = useCallback(
    (newIndex: number) => {
      setCurrentIndex(newIndex);
      onIndexChange?.(newIndex);
    },
    [onIndexChange],
  );

  const goToNext = () => {
    if (currentIndex < galleryImages.length - 1) {
      const newIndex = currentIndex + 1;
      goToImage(newIndex);
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      goToImage(newIndex);
    }
  };

  const goToImage = (index: number) => {
    // Prevent multiple rapid clicks during transition
    if (isTransitioning || index === currentIndex) return;

    setIsTransitioning(true);
    scrollToImage(index);

    // Clear any existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Monitor scroll completion and update state when animation finishes
    const checkScrollCompletion = () => {
      if (carouselRef.current) {
        const scrollLeft = carouselRef.current.scrollLeft;
        const imageWidth = carouselRef.current.clientWidth;
        const targetScrollPosition = index * imageWidth;

        // Check if we're close enough to the target position (within 5px)
        if (Math.abs(scrollLeft - targetScrollPosition) < 5) {
          updateCurrentIndex(index);
          setIsTransitioning(false);
        } else {
          // Continue checking
          scrollTimeoutRef.current = setTimeout(checkScrollCompletion, 50);
        }
      }
    };

    // Start checking after a short delay to let the smooth scroll begin
    scrollTimeoutRef.current = setTimeout(checkScrollCompletion, 100);
  };

  const scrollToImage = (index: number) => {
    if (carouselRef.current) {
      const imageElement = carouselRef.current.children[index] as HTMLElement;
      if (imageElement) {
        imageElement.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    }
  };

  // Handle scroll snap detection to update current index
  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    const handleScroll = () => {
      // Don't update during manual transitions to avoid conflicts
      if (isTransitioning) return;

      const scrollLeft = carousel.scrollLeft;
      const imageWidth = carousel.clientWidth;
      const newIndex = Math.round(scrollLeft / imageWidth);

      if (
        newIndex !== currentIndex &&
        newIndex >= 0 &&
        newIndex < galleryImages.length
      ) {
        updateCurrentIndex(newIndex);
      }
    };

    carousel.addEventListener("scroll", handleScroll, { passive: true });
    return () => carousel.removeEventListener("scroll", handleScroll);
  }, [currentIndex, isTransitioning, updateCurrentIndex]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Initialize scroll position
  useEffect(() => {
    if (carouselRef.current && initialIndex > 0) {
      scrollToImage(initialIndex);
    }
  }, [initialIndex]);

  return (
    <div
      className="fixed inset-0 backdrop-blur-sm z-50 flex flex-col transition-colors duration-700"
      style={{
        backgroundColor: dominantColor
          .replace("hsl(", "hsla(")
          .replace(")", ", 0.9)"),
      }}
    >
      <CarouselTopBar onClose={onClose} />

      <h1
        className="text-3xl text-center font-bold text-white"
        style={{ letterSpacing: "-0.05em" }}
      >
        the beauty of earth.
      </h1>

      <div className="flex-1 relative overflow-hidden">
        {/* Main carousel container with scroll snap */}
        <div
          ref={carouselRef}
          className="flex h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {galleryImages.map((image, index) => (
            <div
              key={image.id}
              className="flex-shrink-0 w-full h-full flex items-center justify-center snap-center px-4"
            >
              <CarouselImage
                ref={index === currentIndex ? currentImageRef : null}
                src={image.src}
                alt={image.title}
                priority={Math.abs(index - currentIndex) <= 1}
                blurDataURL={image.blurDataURL}
              />
            </div>
          ))}
        </div>

        {/* Navigation arrows */}
        <CarouselNavigation
          onNext={goToNext}
          onPrevious={goToPrevious}
          canGoNext={currentIndex < galleryImages.length - 1}
          canGoPrevious={currentIndex > 0}
        />
      </div>

      <div className="flex-shrink-0 px-6 pb-10 space-y-4">
        <ImageInfo image={currentImage} />
        <ImageIndicators
          images={galleryImages}
          currentIndex={currentIndex}
          onImageSelect={goToImage}
        />
      </div>
    </div>
  );
}
