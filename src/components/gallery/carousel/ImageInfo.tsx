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
    <div aria-live="polite" className="min-w-0 text-center lg:text-left">
      <h2 className="text-pretty font-semibold text-[1.0625rem] text-white leading-tight tracking-[-0.025em] sm:text-lg [text-shadow:0_1px_12px_oklch(0%_0_0_/_0.4)]">
        {image.title}
      </h2>
      {/*
        Two lines, always, at every width.

        Descriptions run to one line or two depending on the sentence, and
        the caption bar is laid out below the photograph — so the bar's
        height is subtracted from the image's. Three photographs in fourteen
        were 18px taller here, which meant selecting one of them resized the
        photograph above and moved the credit and the whole thumbnail dock
        with it.

        Reserving the taller of the two costs a line of air under the short
        captions and buys a caption that never moves. `line-clamp-2` closes
        the other side, so a long description from a future contributor
        cannot reopen the same gap — and the clamp is what makes this a
        guarantee rather than a bet on how people write.
      */}
      <p className="mt-1 line-clamp-2 min-h-9 text-pretty text-[0.8125rem] text-white/55 leading-snug">
        {image.description}
      </p>
    </div>
  );
}
