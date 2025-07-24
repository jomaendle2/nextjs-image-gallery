import { useState, useRef } from "react";
import { galleryImages } from "@/data/galleryData";
import { CarouselTopBar } from "./carousel/CarouselTopBar";
import { CarouselNavigation } from "./carousel/CarouselNavigation";
import { CarouselImage } from "./carousel/CarouselImage";
import { ImageInfo } from "./carousel/ImageInfo";
import { ImageIndicators } from "./carousel/ImageIndicators";
import { useCarouselKeyboard } from "./carousel/useCarouselKeyboard";
import { useImageColor } from "./carousel/useImageColor";

interface ImageCarouselProps {
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onViewModeChange: () => void;
}

export function ImageCarousel({
  currentIndex,
  onIndexChange,
  onViewModeChange,
}: ImageCarouselProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const currentImage = galleryImages[currentIndex];
  const { dominantColor, updateDominantColor } = useImageColor(
    imageRef,
    currentImage.id,
    currentIndex,
  );

  const handleImageLoad = async () => {
    setIsLoading(false);
    setIsTransitioning(false);
    await updateDominantColor();
  };

  const handlePrevious = () => {
    const newIndex =
      currentIndex === 0 ? galleryImages.length - 1 : currentIndex - 1;
    onIndexChange(newIndex);
    setIsLoading(true);
    setIsTransitioning(true);
  };

  const handleNext = () => {
    const newIndex =
      currentIndex === galleryImages.length - 1 ? 0 : currentIndex + 1;
    onIndexChange(newIndex);
    setIsLoading(true);
    setIsTransitioning(true);
  };

  useCarouselKeyboard({
    onPrevious: handlePrevious,
    onNext: handleNext,
    onViewModeChange,
    currentIndex,
  });

  return (
    <div
      className="min-h-screen w-full transition-colors duration-500 ease-out relative overflow-hidden"
      style={{
        backgroundColor: dominantColor,
        contain: "layout style paint",
      }}
    >
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/30" />

      <CarouselTopBar
        currentIndex={currentIndex}
        totalImages={galleryImages.length}
        onViewModeChange={onViewModeChange}
      />

      {/* Main image container */}
      <div className="flex items-center justify-center min-h-screen px-6 md:px-20">
        <div className="relative max-w-5xl w-full">
          <CarouselNavigation
            onPrevious={handlePrevious}
            onNext={handleNext}
            isTransitioning={isTransitioning}
          />

          <CarouselImage
            key={currentImage.id}
            ref={imageRef}
            src={currentImage.src}
            alt={currentImage.title}
            blurDataURL={currentImage.blurDataURL}
            onLoad={handleImageLoad}
            priority={true}
          />

          <ImageInfo
            title={currentImage.title}
            description={currentImage.description}
          />
        </div>
      </div>

      <ImageIndicators
        totalImages={galleryImages.length}
        currentIndex={currentIndex}
        onIndexChange={onIndexChange}
      />
    </div>
  );
}
