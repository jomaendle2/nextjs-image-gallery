import Image, { type StaticImageData } from "next/image";
import type { Ref } from "react";

interface CarouselImageProps {
  src: StaticImageData;
  alt: string;
  priority?: boolean;
  onClick?: () => void;
  ref?: Ref<HTMLImageElement>;
}

/**
 * The photograph itself, and nothing between it and the reader.
 *
 * This used to hold the image at `opacity-0` until React's `onLoad` fired,
 * with a spinner underneath. Three things were wrong with that, and they
 * compounded:
 *
 * **It broke the no-JavaScript promise.** The opacity came from component
 * state, so with scripting off the photograph never appeared at all — on the
 * two routes that are most of the site. `/globe` and `/by/[slug]` degrade
 * correctly; these did not.
 *
 * **It cost the LCP measurement outright.** An element at `opacity: 0` does
 * not count as a largest contentful paint, so the metric was gated on parsing
 * and running the page's JavaScript rather than on the image bytes — which
 * meant the `priority` preload above was buying nothing for the number it
 * exists to move.
 *
 * **The spinner was never visible anyway.** `placeholder="blur"` paints the
 * blur data URL onto the image element from first paint, and the image sits
 * at `z-20` above the spinner, so the spinner was covered by the thing it was
 * supposedly standing in for.
 *
 * So the blur is the loading state now, which is what `PhotoCard` and
 * `PhotoGrid` already do. It needs no state, no effect and no script: the
 * browser shows the blur, then swaps in the photograph when it has it.
 *
 * `onLoad` went with it. The prop existed and the one call site never passed
 * it, so the whole `imageLoaded` machine was in service of an opacity toggle
 * that should not have been there.
 */
export function CarouselImage({
  src,
  alt,
  priority = false,
  onClick,
  ref,
}: CarouselImageProps) {
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
           *
           * `transition-transform` rather than `transition-all`: the only
           * thing that animates here is the hover scale, and `all` would have
           * animated the opacity swap next/image performs when the blur is
           * replaced by the photograph.
           */
          className="max-w-full z-20 max-h-full w-auto object-contain rounded-2xl overflow-hidden ring-1 ring-inset ring-white/12 shadow-[0_30px_80px_-28px_oklch(0%_0_0_/_0.7),0_4px_14px_-6px_oklch(0%_0_0_/_0.45)] transition-transform duration-500 group-hover:scale-[1.02] group-active:scale-[0.98] motion-reduce:transition-none"
          loading={priority ? "eager" : "lazy"}
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
