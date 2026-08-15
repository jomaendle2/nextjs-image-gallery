import type { GalleryImage } from "@/data/galleryData";

interface ImageInfoProps {
  image: GalleryImage;
}

/**
 * The left half of the wall label: what the photograph is.
 *
 * The live region covers the caption only. Including the view counter made
 * every tick of its digit animation an announcement, so the whole caption was
 * re-read while the number counted up.
 */
export function ImageInfo({ image }: ImageInfoProps) {
  return (
    <div aria-live="polite" className="min-w-0 text-center sm:text-left">
      <h2 className="text-pretty font-semibold text-[1.0625rem] text-white leading-tight tracking-[-0.025em] sm:text-lg [text-shadow:0_1px_12px_oklch(0%_0_0_/_0.4)]">
        {image.title}
      </h2>
      <p className="mt-1 text-pretty text-[0.8125rem] text-white/55 leading-snug">
        {image.description}
      </p>
    </div>
  );
}
