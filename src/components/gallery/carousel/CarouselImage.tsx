import { forwardRef } from "react";
import Image from "next/image";

interface CarouselImageProps {
  src: string;
  alt: string;
  isLoading: boolean;
  onLoad: () => void;
}

export const CarouselImage = forwardRef<HTMLImageElement, CarouselImageProps>(
  ({ src, alt, isLoading, onLoad }, ref) => {
    return (
      <div className="relative rounded-3xl overflow-hidden shadow-intense bg-black/15 transform-gpu">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-3xl">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gallery-text"></div>
          </div>
        )}

        <Image
          ref={ref}
          width={800}
          height={600}
          src={src}
          alt={alt}
          className={`w-full h-auto max-h-[70vh] object-contain transition-opacity duration-300 transform-gpu ${
            isLoading ? "opacity-0" : "opacity-100"
          }`}
          onLoad={onLoad}
          style={{ willChange: "opacity" }}
        />
      </div>
    );
  },
);

CarouselImage.displayName = "CarouselImage";
