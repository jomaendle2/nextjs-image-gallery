import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Share2, Grid3x3 } from "lucide-react";
import { GlassButton } from "@/components/ui/glass-button";
import { extractDominantColorDebounced } from "@/utils/colorExtractor";
import { galleryImages } from "@/data/galleryData";
import { toast } from "sonner";
import Image from "next/image";

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
  const [dominantColor, setDominantColor] = useState("hsl(220, 20%, 15%)");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  const currentImage = galleryImages[currentIndex];

  useEffect(() => {
    const updateDominantColor = async () => {
      if (imageRef.current && imageRef.current.complete) {
        try {
          const color = await extractDominantColorDebounced(
            imageRef.current,
            currentImage.id,
          );
          setDominantColor(color);
        } catch (error) {
          console.error("Error extracting color:", error);
        }
      }
    };

    updateDominantColor();
  }, [currentIndex, currentImage.id]);

  const handleImageLoad = async () => {
    setIsLoading(false);
    setIsTransitioning(false);
    if (imageRef.current) {
      try {
        const color = await extractDominantColorDebounced(
          imageRef.current,
          currentImage.id,
        );
        setDominantColor(color);
      } catch (error) {
        console.error("Error extracting color:", error);
      }
    }
  };

  const handlePrevious = () => {
    setIsTransitioning(true);
    onIndexChange(
      currentIndex === 0 ? galleryImages.length - 1 : currentIndex - 1,
    );
  };

  const handleNext = () => {
    setIsTransitioning(true);
    onIndexChange(
      currentIndex === galleryImages.length - 1 ? 0 : currentIndex + 1,
    );
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: currentImage.title,
          text: currentImage.description,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Link copied to clipboard!");
      }
    } catch (error) {
      console.error("Error sharing:", error);
      toast.error("Failed to share image");
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        handlePrevious();
      }
      if (e.key === "ArrowRight") {
        handleNext();
      }
      if (e.key === "Escape") {
        onViewModeChange();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex]);

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

      {/* Top bar */}
      <div className="absolute top-6 left-6 right-6 z-20 flex justify-between items-center">
        <div className="text-gallery-text/80 text-sm font-medium">
          {currentIndex + 1} of {galleryImages.length}
        </div>
        <GlassButton
          variant="icon"
          onClick={onViewModeChange}
          className="hover:scale-105 transition-transform duration-200"
        >
          <Grid3x3 size={20} />
        </GlassButton>
      </div>

      {/* Main image container */}
      <div className="flex items-center justify-center min-h-screen px-6 md:px-20">
        <div className="relative max-w-5xl w-full">
          {/* Navigation buttons */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
            <GlassButton
              variant="icon"
              onClick={handlePrevious}
              className="hover:scale-105 transition-transform duration-200"
              disabled={isTransitioning}
            >
              <ChevronLeft size={24} />
            </GlassButton>
          </div>

          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
            <GlassButton
              variant="icon"
              onClick={handleNext}
              className="hover:scale-105 transition-transform duration-200"
              disabled={isTransitioning}
            >
              <ChevronRight size={24} />
            </GlassButton>
          </div>

          {/* Image */}
          <div className="relative rounded-3xl overflow-hidden shadow-intense bg-black/15 transform-gpu">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-3xl">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gallery-text"></div>
              </div>
            )}

            <Image
              ref={imageRef}
              width={imageRef.current?.width || 800}
              height={imageRef.current?.height || 600}
              src={currentImage.src}
              alt={currentImage.title}
              className={`w-full h-auto max-h-[70vh] object-contain transition-opacity duration-300 transform-gpu ${
                isLoading ? "opacity-0" : "opacity-100"
              }`}
              onLoad={handleImageLoad}
              style={{ willChange: "opacity" }}
            />
          </div>

          {/* Image info and controls */}
          <div className="mt-8 text-center space-y-4">
            <div className="space-y-2">
              <h2 className="text-2xl md:text-3xl font-bold text-gallery-text">
                {currentImage.title}
              </h2>
              <p className="text-gallery-muted text-lg max-w-2xl mx-auto">
                {currentImage.description}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-4 pt-4">
              <GlassButton
                onClick={handleShare}
                className="hover:scale-105 transition-transform duration-200"
              >
                <Share2 size={18} className="mr-2" />
                Share
              </GlassButton>
            </div>
          </div>
        </div>
      </div>

      {/* Image indicators */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
        {galleryImages.map((_, index) => (
          <button
            key={index}
            onClick={() => onIndexChange(index)}
            className={`w-2 h-2 rounded-full transition-all duration-200 hover:scale-125 transform-gpu ${
              index === currentIndex
                ? "bg-gallery-text scale-125"
                : "bg-gallery-text/40 hover:bg-gallery-text/60"
            }`}
            style={{ willChange: "transform" }}
          />
        ))}
      </div>
    </div>
  );
}
