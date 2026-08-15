import type { GalleryImage } from "@/data/galleryData";
import { ImageIndicators } from "./ImageIndicators";
import { ImageInfo } from "./ImageInfo";
import { PhotoCredit } from "./PhotoCredit";

interface CaptionBarProps {
  image: GalleryImage;
  images: readonly GalleryImage[];
  currentIndex: number;
  onImageSelect: (index: number) => void;
}

/**
 * The chrome below the photograph, as one full-width baseline rather than a
 * centred stack.
 *
 * The stack spent roughly 200px of height to show about forty characters,
 * while a thousand pixels of width sat empty — and every one of those pixels
 * was taken from the photograph. Anchoring the caption left and the
 * attribution right lets the width carry the information and gives the height
 * back to the image.
 *
 * It is also what stops the page reading as generic: a centred column is the
 * default every dark interface reaches for. Left caption, quiet centre, right
 * technical plate is how an exhibition wall label is actually set.
 *
 * Below `sm` it returns to the centred stack — three columns in 390px would
 * be worse than the thing it replaced.
 */
export function CaptionBar({
  image,
  images,
  currentIndex,
  onImageSelect,
}: CaptionBarProps) {
  return (
    <div className="relative z-10 mx-auto w-full max-w-[1536px] flex-shrink-0 safe-x-4 safe-b-6 sm:safe-x-8 sm:safe-b-7">
      {/*
        Three columns from `lg`, and the middle one is capped at 45% of the
        bar rather than left to size itself.

        The cap is the whole fix. Grid sizes intrinsic tracks before it
        distributes free space to `fr` tracks, so an `auto` middle column
        takes its max-content — every thumbnail laid end to end — and the two
        `1fr` columns divide whatever is left, which was nothing: the title
        wrapped to two lines, the description to one word per line, and the
        attribution ran off the right edge. `fit-content(45%)` lets the strip
        size to its content only up to a share of the bar, past which its own
        `overflow-x-auto` takes over and it scrolls in place. The caption and
        the credit are then guaranteed roughly a quarter of the width each,
        at every screen size, rather than whatever the photo count leaves.

        The breakpoint moved from `sm` to `lg` for the same reason from the
        other direction: three columns plus a strip need real width, and
        640px is not it. Tablets get the stacked layout, which is the one
        that was designed to work narrow.
      */}
      <div className="grid grid-cols-1 items-end gap-4 lg:grid-cols-[minmax(0,1fr)_fit-content(45%)_minmax(0,1fr)] lg:gap-6">
        <ImageInfo image={image} />

        {/*
          Stacked on mobile the credit belongs with the caption it describes,
          above the strip; in the three-column bar it sits on the right.
        */}
        <div className="order-3 min-w-0 lg:order-2">
          <ImageIndicators
            currentIndex={currentIndex}
            images={images}
            onImageSelect={onImageSelect}
          />
        </div>

        <div className="order-2 min-w-0 lg:order-3">
          <PhotoCredit image={image} />
        </div>
      </div>
    </div>
  );
}
