import Image, { type StaticImageData } from "next/image";
import type { Ref } from "react";

interface CarouselImageProps {
  src: StaticImageData;
  alt: string;
  priority?: boolean;
  /**
   * Whether this slot's button is in the tab order. Only the photograph
   * currently on screen should be; the buffered neighbours either side are
   * off-screen, and tabbing to one of them scrolls it into view and changes
   * which photograph the page is showing. See the call site in
   * `ImageCarousel`.
   */
  focusable?: boolean;
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
  focusable = true,
  onClick,
  ref,
}: CarouselImageProps) {
  return (
    /*
      The padding is what the photograph is measured against, so on a short
      viewport it has to be measured in the same currency.

      `pt-6 pb-12` is 72px, unconditionally. That is a comfortable margin under
      a photograph on a desktop and it was the entire stage on a phone in
      landscape, where the row this sits in had collapsed to 27px: the padding
      alone asked for more height than the box had, so `max-h-full` left the
      photograph nothing, it rendered at 0×0 and there was nothing to look at.
      The floor in `ImageCarousel` is the real fix for
      that, but 72px is still a third of the stage at 390px tall, and it buys
      air that a landscape phone does not have to spend.

      A height query rather than a width breakpoint: `sm:` is about width, and
      the viewport this is wrong on is 844px wide. Short is the property that
      matters, and short is the property being asked about.
    */
    <div className="relative w-full h-full flex items-center justify-center pt-6 pb-12 [@media(max-height:640px)]:pt-2 [@media(max-height:640px)]:pb-4">
      {/*
        A real button rather than a click handler on the <img>: it is
        keyboard reachable, exposed to assistive tech, and announces what
        activating it does.
      */}
      <button
        aria-label={`View ${alt} full screen`}
        className="group relative max-w-full h-full flex items-center justify-center max-h-full cursor-pointer rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-[6px] focus-visible:outline-white/80"
        onClick={onClick}
        tabIndex={focusable ? undefined : -1}
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
          /*
           * What the slot is actually worth, not what the viewport is.
           *
           * `100vw / 90vw / 80vw` described a photograph that fills the window.
           * This one never does: the slot has `px-6` around it, and above the
           * phone sizes the image is bounded by the stage's height rather than
           * its width, so it comes in well under the declared share. Measured
           * at 1440×900 the image renders 922px wide while `80vw` claimed
           * 1152 and pulled `w=1200` out of the srcset — a size the browser
           * then scales down. Deducting the padding and asking for a share the
           * picture can actually occupy lands on `w=1080`, which is the next
           * candidate up from what is drawn.
           *
           * Erring one candidate high is deliberate: `sizes` is a promise, and
           * an image that is 8% short of its box is visibly soft where an
           * image 15% over it is only a few kilobytes.
           *
           * The first clause tracks the slot's own breakpoint: below `sm` it
           * keeps only `px-2`, so the picture is worth almost the whole
           * viewport width and saying `100vw - 3rem` there would under-declare
           * it by two rems on the narrowest screens — exactly where a soft
           * photograph is most obvious.
           */
          sizes="(max-width: 640px) calc(100vw - 1rem), (max-width: 768px) calc(100vw - 3rem), (max-width: 1200px) 85vw, 70vw"
          src={src}
        />
      </button>
    </div>
  );
}
