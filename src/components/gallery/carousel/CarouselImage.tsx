import Image from "next/image";

interface CarouselImageProps {
  src: string;
  alt: string;
  onLoad?: () => void;
  priority?: boolean;
  blurDataURL?: string;
}

export function CarouselImage({
  src,
  alt,
  onLoad,
  priority = false,
  blurDataURL,
}: CarouselImageProps) {
  const handleLoad = () => {
    onLoad?.();
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center px-4 py-6">
      <div className="relative max-w-full h-full flex items-center justify-center max-h-full">
        <Image
          src={src}
          alt={alt}
          width={1200}
          height={800}
          className={`max-w-full max-h-full w-full object-contain rounded-2xl overflow-hidden transition-all shadow-2xl border-6 md:border-8 border-neutral-500/15 duration-500`}
          onLoad={handleLoad}
          priority={priority}
          placeholder={blurDataURL ? "blur" : "empty"}
          blurDataURL={blurDataURL}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 80vw"
        />
      </div>
    </div>
  );
}
