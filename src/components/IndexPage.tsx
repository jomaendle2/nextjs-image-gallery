"use client";
import { useState, useRef } from "react";
import { ImageCarousel } from "@/components/gallery/ImageCarousel";
import { ImageGrid } from "@/components/gallery/ImageGrid";
import { useImageColor } from "@/components/gallery/carousel/useImageColor";
import { galleryImages } from "@/data/galleryData";

type ViewMode = "carousel" | "grid";

const Index = () => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("carousel");
  const imageRef = useRef<HTMLImageElement>(null);

  // Get current image data
  const currentImage = galleryImages[currentImageIndex];

  // Use the image color hook for background adaptation
  const { dominantColor } = useImageColor(
    imageRef,
    currentImage.id,
    currentImageIndex,
  );

  const handleViewModeChange = () => {
    setViewMode(viewMode === "carousel" ? "grid" : "carousel");
  };

  const handleImageSelect = (index: number) => {
    setCurrentImageIndex(index);
  };

  if (viewMode === "grid") {
    return (
      <ImageGrid
        onImageSelect={handleImageSelect}
        onViewModeChange={handleViewModeChange}
      />
    );
  }

  return (
    <div
      className="min-h-screen transition-colors duration-700"
      style={{
        backgroundColor: dominantColor
          .replace("hsl(", "hsla(")
          .replace(")", ", 0.1)"),
      }}
    >
      <ImageCarousel
        currentIndex={currentImageIndex}
        onIndexChange={setCurrentImageIndex}
        onViewModeChange={handleViewModeChange}
      />
    </div>
  );
};

export default Index;
