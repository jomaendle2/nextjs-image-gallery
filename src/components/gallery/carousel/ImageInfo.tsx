import { ViewCount } from "@/components/gallery/ViewCount";
import type { GalleryImage } from "@/data/galleryData";

interface ImageInfoProps {
  image: GalleryImage;
}

export function ImageInfo({ image }: ImageInfoProps) {
  return (
    <div
      aria-live="polite"
      className="text-center text-white px-6 max-w-2xl mx-auto h-24 flex flex-col justify-center"
    >
      <h2 className="font-semibold text-lg sm:text-xl mb-1.5 text-white tracking-[-0.02em] text-pretty leading-tight [text-shadow:0_1px_12px_oklch(0%_0_0_/_0.4)]">
        {image.title}
      </h2>
      <p className="text-[0.8125rem] sm:text-sm text-white/65 leading-snug mb-2.5 text-balance">
        {image.description}
      </p>
      <div className="flex justify-center items-center">
        <ViewCount
          imageId={image.id}
          variant="gallery"
          className="opacity-80 hover:opacity-100 transition-opacity duration-200"
        />
      </div>
    </div>
  );
}
