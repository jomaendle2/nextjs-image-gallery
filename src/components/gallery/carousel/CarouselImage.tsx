import { forwardRef, useState } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";

interface CarouselImageProps {
  src: string;
  alt: string;
  onLoad: () => void;
  priority?: boolean;
  blurDataURL?: string;
}

export const CarouselImage = forwardRef<HTMLImageElement, CarouselImageProps>(
  ({ src, alt, onLoad, priority = false, blurDataURL }, ref) => {
    const [imageLoaded, setImageLoaded] = useState(false);

    const handleImageLoad = () => {
      setImageLoaded(true);
      onLoad();
    };

    return (
      <div className="relative rounded-3xl overflow-hidden shadow-intense bg-black/15 transform-gpu">
        {/* Blur placeholder - always visible initially, fades out when image loads */}
        {blurDataURL && (
          <>
            <div
              className={`absolute inset-0 flex items-center justify-center w-full h-full bg-cover bg-center transform-gpu transition-opacity duration-500 ease-out ${
                imageLoaded ? "motion-opacity-out" : "motion-preset-fade"
              }`}
              style={{
                backgroundImage: `url(${blurDataURL})`,
                filter: "blur(20px)",
                transform: "scale(1.1)", // Slightly scale to hide blur edges
                willChange: "opacity",
              }}
            ></div>
            {!imageLoaded && (
              <div className="text-gallery-text/80 absolute inset-0 flex items-center justify-center z-20 h-full w-full">
                <Loader2 className="size-8 m-auto animate-spin" />
              </div>
            )}
          </>
        )}

        <Image
          ref={ref}
          width={800}
          height={600}
          src={src}
          alt={alt}
          priority={priority}
          quality={90}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
          className={`w-full h-auto max-h-[70vh] aspect-[16/10] object-cover transform-gpu transition-opacity duration-500 ease-out ${
            imageLoaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={handleImageLoad}
          style={{ willChange: "opacity" }}
        />
      </div>
    );
  },
);

CarouselImage.displayName = "CarouselImage";
