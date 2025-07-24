import Image from "next/image";
import { useState } from "react";

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
  const [isLoaded, setIsLoaded] = useState(false);

  const handleLoad = () => {
    setIsLoaded(true);
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
          className={`max-w-full max-h-full w-full object-contain rounded-2xl transition-all shadow-2xl border-8 border-neutral-500/15 duration-500 ${
            isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
          onLoad={handleLoad}
          priority={priority}
          placeholder={blurDataURL ? "blur" : "empty"}
          blurDataURL={blurDataURL}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 80vw"
        />

        {/* Loading state with blur image */}
        {!isLoaded && blurDataURL && (
          <div className="absolute inset-0 rounded-2xl overflow-hidden">
            <Image
              src={blurDataURL}
              alt=""
              fill
              className="object-contain scale-110 blur-sm"
              priority
            />
            <div className="absolute inset-0 bg-black/20 rounded-2xl flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            </div>
          </div>
        )}

        {/* Fallback loading for images without blur */}
        {!isLoaded && !blurDataURL && (
          <div className="absolute inset-0 rounded-2xl bg-gray-900/30 backdrop-blur-sm flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
