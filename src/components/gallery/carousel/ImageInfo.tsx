import { type GalleryImage } from "@/data/galleryData";
import { ViewCount } from "@/components/gallery/ViewCount";

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
