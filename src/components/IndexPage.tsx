"use client";
import { useState } from "react";
import { ImageCarousel } from "@/components/gallery/ImageCarousel";
import { ImageGrid } from "@/components/gallery/ImageGrid";

type ViewMode = "carousel" | "grid";

const Index = () => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("carousel");

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
    <ImageCarousel
      currentIndex={currentImageIndex}
      onIndexChange={setCurrentImageIndex}
      onViewModeChange={handleViewModeChange}
    />
  );
};

export default Index;
