import Image, { type StaticImageData } from "next/image";
import { type Ref, useCallback, useState } from "react";

interface CarouselImageProps {
  src: StaticImageData;
  alt: string;
  onLoad?: () => void;
  priority?: boolean;
  onClick?: () => void;
  ref?: Ref<HTMLImageElement>;
}

export function CarouselImage({
  src,
  alt,
  onLoad,
  priority = false,
  onClick,
  ref,
}: CarouselImageProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleLoad = useCallback(() => {
    setImageLoaded(true);
    onLoad?.();
  }, [onLoad]);

  return (
    <div className="relative w-full h-full flex items-center justify-center py-6">
      {/*
        A real button rather than a click handler on the <img>: it is
        keyboard reachable, exposed to assistive tech, and announces what
        activating it does.
      */}
      <button
        aria-label={`View ${alt} full screen`}
        className="group relative max-w-full h-full flex items-center justify-center max-h-full pb-6 cursor-pointer"
        onClick={onClick}
        type="button"
      >
        {/* Loading placeholder that matches the image dimensions exactly */}
        <div
          className={`absolute max-w-full max-h-full w-full h-full flex items-center justify-center transition-opacity duration-500 ${imageLoaded ? "opacity-0" : "opacity-100"}`}
        >
          <div className="size-8 aspect-square border-2 border-white/30 border-t-white rounded-full animate-spin motion-reduce:animate-none" />
        </div>

        <Image
          alt={alt}
          className={`max-w-full z-20 max-h-full w-auto object-contain rounded-2xl overflow-hidden transition-all shadow-2xl border-6 md:border-8 border-neutral-500/15 duration-500 group-hover:scale-[1.02] group-active:scale-[0.98] ${imageLoaded ? "opacity-100" : "opacity-0"}`}
          loading={priority ? "eager" : "lazy"}
          onLoad={handleLoad}
          placeholder="blur"
          priority={priority}
          ref={ref}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 80vw"
          src={src}
        />
      </button>
    </div>
  );
}
