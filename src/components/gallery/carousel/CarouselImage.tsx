import Image from "next/image";
import { forwardRef } from "react";

interface CarouselImageProps {
  src: string;
  alt: string;
  onLoad?: () => void;
  priority?: boolean;
  blurDataURL?: string;
}

export const CarouselImage = forwardRef<HTMLImageElement, CarouselImageProps>(
  ({ src, alt, onLoad, priority = false, blurDataURL }, ref) => {
    const handleLoad = () => {
      onLoad?.();
    };

    return (
      <div className="relative w-full h-full flex items-center justify-center py-6">
        <div className="relative max-w-full h-full flex items-center justify-center max-h-full pb-6">
          <Image
            ref={ref}
            src={src}
            alt={alt}
            width={1200}
            height={800}
            className={`max-w-full max-h-full w-auto object-contain rounded-2xl overflow-hidden transition-all shadow-2xl border-6 md:border-8 border-neutral-500/15 duration-500`}
            onLoad={handleLoad}
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
