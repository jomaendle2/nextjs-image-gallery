import type { GalleryImage } from "@/data/galleryData";
import { ImageIndicators } from "./ImageIndicators";
import { ImageInfo } from "./ImageInfo";
import { PhotoCredit } from "./PhotoCredit";

interface CaptionBarProps {
  image: GalleryImage;
  images: readonly GalleryImage[];
  currentIndex: number;
  onImageSelect: (index: number) => void;
  linkAuthor: boolean;
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
  linkAuthor,
}: CaptionBarProps) {
  return (
    <div className="relative z-10 flex-shrink-0 px-4 pb-6 sm:px-8 sm:pb-7">
      <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-6">
        <ImageInfo image={image} />

        {/*
          Stacked on mobile the credit belongs with the caption it describes,
          above the strip; in the three-column bar it sits on the right.
        */}
        <div className="order-3 sm:order-2">
          <ImageIndicators
            currentIndex={currentIndex}
            images={images}
            onImageSelect={onImageSelect}
          />
        </div>

        <div className="order-2 sm:order-3">
          <PhotoCredit image={image} linkAuthor={linkAuthor} />
        </div>
      </div>
    </div>
  );
}
