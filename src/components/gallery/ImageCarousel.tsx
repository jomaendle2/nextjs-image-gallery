"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { CarouselImage } from "./carousel/CarouselImage";
import { CarouselNavigation } from "./carousel/CarouselNavigation";
import { CarouselTopBar } from "./carousel/CarouselTopBar";
import { ImageIndicators } from "./carousel/ImageIndicators";
import { ImageInfo } from "./carousel/ImageInfo";
import { galleryImages } from "@/data/galleryData";
import { useCarouselKeyboard } from "./carousel/useCarouselKeyboard";

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
  const [bgColor, setBgColor] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentImageRef = useRef<HTMLImageElement>(null);
  const throttleRef = useRef<NodeJS.Timeout | null>(null);

  // Buffer size: how many images to render on each side of current image
  const BUFFER_SIZE = 1;

  // Calculate which images should be rendered
  const getVisibleIndices = useCallback(() => {
    const start = Math.max(0, currentIndex - BUFFER_SIZE);
    const end = Math.min(galleryImages.length - 1, currentIndex + BUFFER_SIZE);
    return { start, end };
  }, [currentIndex]);

  useEffect(() => {
    const currentImage = galleryImages[currentIndex];
    if (!currentImage) {
      return;
    }

    setBgColor(currentImage.bgColor);
  }, [currentIndex]);

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

  // Create throttled scroll handler using useRef for better performance
  const handleScroll = useCallback(() => {
    const carousel = carouselRef.current;
    if (!carousel || isTransitioning) return;

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
  }, [currentIndex, isTransitioning, updateCurrentIndex]);

  const throttledScrollHandler = useCallback(() => {
    if (throttleRef.current) return;

    throttleRef.current = setTimeout(() => {
      handleScroll();
      throttleRef.current = null;
    }, 16); // ~60fps throttling
  }, [handleScroll]);

  // Handle scroll snap detection to update current index
  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    carousel.addEventListener("scroll", throttledScrollHandler, {
      passive: true,
    });
    return () => carousel.removeEventListener("scroll", throttledScrollHandler);
  }, [throttledScrollHandler]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (throttleRef.current) {
        clearTimeout(throttleRef.current);
      }
    };
  }, []);

  // Initialize scroll position
  useEffect(() => {
    if (carouselRef.current && initialIndex > 0) {
      scrollToImage(initialIndex);
    }
  }, [initialIndex]);

  const { start, end } = getVisibleIndices();

  return (
    <div
      className="fixed inset-0 backdrop-blur-sm z-50 flex flex-col transition-colors duration-700"
      style={{
        backgroundColor: bgColor || galleryImages[0].bgColor,
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
          {galleryImages.map((image, index) => {
            // Only render images within the visible range
            const shouldRender = index >= start && index <= end;

            return (
              <div
                key={image.id}
                className="flex-shrink-0 w-full h-full flex items-center justify-center snap-center px-6"
              >
                {shouldRender ? (
                  <CarouselImage
                    ref={index === currentIndex ? currentImageRef : null}
                    src={image.src}
                    alt={image.title}
                    priority={index === currentIndex}
                    blurDataURL={image.blurDataURL}
                  />
                ) : (
                  // Placeholder div to maintain scroll positions
                  <div className="w-full h-full" />
                )}
              </div>
            );
          })}
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
        <ImageInfo image={galleryImages[currentIndex]} />
        <ImageIndicators
          images={galleryImages}
          currentIndex={currentIndex}
          onImageSelect={goToImage}
        />
      </div>
    </div>
  );
}
