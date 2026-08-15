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
    <div className="relative w-full h-full flex items-center justify-center pt-6 pb-12">
      {/*
        A real button rather than a click handler on the <img>: it is
        keyboard reachable, exposed to assistive tech, and announces what
        activating it does.
      */}
      <button
        aria-label={`View ${alt} full screen`}
        className="group relative max-w-full h-full flex items-center justify-center max-h-full cursor-pointer rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-[6px] focus-visible:outline-white/80"
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
          /*
           * No mat around the photograph. A 6-8px translucent neutral border
           * composites almost black over the image edge, so every picture sat
           * inside a grey frame that read as a rendering artefact rather than
           * a deliberate mount. Depth now comes from elevation instead: a long
           * soft shadow to lift the photo off the colour field, a tighter one
           * for contact, and an inset hairline so the edge stays defined where
           * the image itself is pale.
           */
          className={`max-w-full z-20 max-h-full w-auto object-contain rounded-2xl overflow-hidden ring-1 ring-inset ring-white/12 shadow-[0_30px_80px_-28px_oklch(0%_0_0_/_0.7),0_4px_14px_-6px_oklch(0%_0_0_/_0.45)] transition-all duration-500 group-hover:scale-[1.02] group-active:scale-[0.98] ${imageLoaded ? "opacity-100" : "opacity-0"}`}
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
