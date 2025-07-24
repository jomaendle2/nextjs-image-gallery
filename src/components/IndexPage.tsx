"use client";
import { useState, useRef } from "react";
import { ImageCarousel } from "@/components/gallery/ImageCarousel";
import { useImageColor } from "@/components/gallery/carousel/useImageColor";
import { galleryImages } from "@/data/galleryData";

const Index = () => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const imageRef = useRef<HTMLImageElement>(null);

  // Get current image data
  const currentImage = galleryImages[currentImageIndex];

  // Use the image color hook for background adaptation
  const { dominantColor } = useImageColor(
    imageRef,
    currentImage.id,
    currentImageIndex,
  );

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
      />
    </div>
  );
};

export default Index;
