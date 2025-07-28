import Image from "next/image";
import { forwardRef, useState } from "react";

interface CarouselImageProps {
  src: string;
  alt: string;
  onLoad?: () => void;
  priority?: boolean;
  blurDataURL?: string;
  onClick?: () => void;
}

export const CarouselImage = forwardRef<HTMLImageElement, CarouselImageProps>(
  ({ src, alt, onLoad, priority = false, blurDataURL, onClick }, ref) => {
    const [imageLoaded, setImageLoaded] = useState(false);

    const handleLoad = () => {
      setImageLoaded(true);
      onLoad?.();
    };

    return (
      <div className="relative w-full h-full flex items-center justify-center py-6">
        <div className="relative max-w-full h-full flex items-center justify-center max-h-full pb-6">
          {/* Loading placeholder that matches the image dimensions exactly */}
          <div
            className={`absolute max-w-full max-h-full w-full h-full flex items-center justify-center transition-opacity duration-500 ${imageLoaded ? "opacity-0" : "opacity-100"}`}
          >
            <div className="size-8 aspect-square border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>

          <Image
            ref={ref}
            src={src}
            alt={alt}
            width={1200}
            height={800}
            className={`max-w-full z-20 max-h-full w-auto object-contain rounded-2xl overflow-hidden transition-all shadow-2xl border-6 md:border-8 border-neutral-500/15 duration-500 cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${imageLoaded ? "opacity-100" : "opacity-0"}`}
            onLoad={handleLoad}
            onClick={onClick}
            priority={priority}
            placeholder={blurDataURL ? "blur" : "empty"}
            blurDataURL={blurDataURL}
            loading={priority ? "eager" : "lazy"}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 80vw"
          />
        </div>
      </div>
    );
  },
);

CarouselImage.displayName = "CarouselImage";
