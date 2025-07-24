"use client";

import { useState, useRef, useEffect } from "react";
import { CarouselImage } from "./carousel/CarouselImage";
import { CarouselNavigation } from "./carousel/CarouselNavigation";
import { CarouselTopBar } from "./carousel/CarouselTopBar";
import { ImageIndicators } from "./carousel/ImageIndicators";
import { ImageInfo } from "./carousel/ImageInfo";
import { galleryImages, type GalleryImage } from "@/data/galleryData";
import { useCarouselKeyboard } from "./carousel/useCarouselKeyboard";

interface ImageCarouselProps {
  initialIndex?: number;
  onClose?: () => void;
}

export function ImageCarousel({
  initialIndex = 0,
  onClose,
}: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [imagesLoaded, setImagesLoaded] = useState<Record<string, boolean>>({});
  const carouselRef = useRef<HTMLDivElement>(null);

  // Handle keyboard navigation
  useCarouselKeyboard({
    onNext: () => goToNext(),
    onPrevious: () => goToPrevious(),
    onClose: onClose,
  });

  const goToNext = () => {
    if (currentIndex < galleryImages.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      scrollToImage(newIndex);
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      scrollToImage(newIndex);
    }
  };

  const goToImage = (index: number) => {
    setCurrentIndex(index);
    scrollToImage(index);
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

  const handleImageLoad = (imageId: string) => {
    setImagesLoaded((prev) => ({ ...prev, [imageId]: true }));
  };

  // Handle scroll snap detection to update current index
  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    const handleScroll = () => {
      const scrollLeft = carousel.scrollLeft;
      const imageWidth = carousel.clientWidth;
      const newIndex = Math.round(scrollLeft / imageWidth);

      if (
        newIndex !== currentIndex &&
        newIndex >= 0 &&
        newIndex < galleryImages.length
      ) {
        setCurrentIndex(newIndex);
      }
    };

    carousel.addEventListener("scroll", handleScroll, { passive: true });
    return () => carousel.removeEventListener("scroll", handleScroll);
  }, [currentIndex]);

  // Initialize scroll position
  useEffect(() => {
    if (carouselRef.current && initialIndex > 0) {
      scrollToImage(initialIndex);
    }
  }, [initialIndex]);

  const currentImage = galleryImages[currentIndex];

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex flex-col">
      <CarouselTopBar
        currentIndex={currentIndex}
        totalImages={galleryImages.length}
        onClose={onClose}
      />

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
                src={image.src}
                alt={image.title}
                onLoad={() => handleImageLoad(image.id)}
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

      {/* Bottom controls */}
      <div className="flex-shrink-0 p-6 space-y-4">
        <ImageIndicators
          images={galleryImages}
          currentIndex={currentIndex}
          onImageSelect={goToImage}
        />

        <ImageInfo
          image={currentImage}
          currentIndex={currentIndex}
          totalImages={galleryImages.length}
        />
      </div>
    </div>
  );
}
