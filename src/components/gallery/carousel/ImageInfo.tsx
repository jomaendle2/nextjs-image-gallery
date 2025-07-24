import { type GalleryImage } from "@/data/galleryData";

interface ImageInfoProps {
  image: GalleryImage;
  currentIndex: number;
  totalImages: number;
}

export function ImageInfo({
  image,
  currentIndex,
  totalImages,
}: ImageInfoProps) {
  return (
    <div className="text-center text-white px-6 max-w-2xl mx-auto">
      <h3 className="font-semibold text-xl mb-2 text-white/95 tracking-tight leading-tight">
        {image.title}
      </h3>
      <p className="text-sm text-white/70 leading-relaxed mb-3 font-medium">
        {image.description}
      </p>
      <p className="text-xs text-white/50 font-medium tracking-wide">
        {currentIndex + 1} of {totalImages}
      </p>
    </div>
  );
}
