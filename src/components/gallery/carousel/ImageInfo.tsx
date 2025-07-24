import { type GalleryImage } from "@/data/galleryData";

interface ImageInfoProps {
  image: GalleryImage;
}

export function ImageInfo({ image }: ImageInfoProps) {
  return (
    <div className="text-center text-white px-6 max-w-2xl mx-auto h-24 flex flex-col justify-center">
      <h3 className="font-semibold text-xl mb-2 text-white/95 tracking-tight text-pretty leading-tight">
        {image.title}
      </h3>
      <p className="text-sm text-white/70 leading-tight mb-3 font-medium text-balance">
        {image.description}
      </p>
    </div>
  );
}
