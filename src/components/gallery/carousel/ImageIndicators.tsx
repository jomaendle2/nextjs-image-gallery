import Image from "next/image";
import { useEffect, useRef } from "react";
import { type GalleryImage } from "@/data/galleryData";

interface ImageIndicatorsProps {
  images: GalleryImage[];
  currentIndex: number;
  onImageSelect: (index: number) => void;
}

export function ImageIndicators({
  images,
  currentIndex,
  onImageSelect,
}: ImageIndicatorsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeButtonRef = useRef<HTMLButtonElement>(null);

  // Scroll to active thumbnail when currentIndex changes
  useEffect(() => {
    if (containerRef.current && activeButtonRef.current) {
      const container = containerRef.current;
      const activeButton = activeButtonRef.current;

      const containerRect = container.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();

      // Calculate if button is outside visible area
      const isButtonVisible =
        buttonRect.left >= containerRect.left &&
        buttonRect.right <= containerRect.right;

      if (!isButtonVisible) {
        // Calculate scroll position to center the active button
        const buttonCenter =
          activeButton.offsetLeft + activeButton.offsetWidth / 2;
        const containerCenter = container.offsetWidth / 2;
        const scrollPosition = buttonCenter - containerCenter;

        container.scrollTo({
          left: scrollPosition,
          behavior: "smooth",
        });
      }
    }
  }, [currentIndex]);

  return (
    <div className="flex justify-center pb-4">
      <div
        ref={containerRef}
        className="flex items-center gap-3 p-3 h-[90px] bg-black/20 backdrop-blur-xl rounded-2xl border border-white/10 max-w-full overflow-x-auto scrollbar-hide shadow-lg"
      >
        {images.map((image, index) => (
          <button
            key={image.id}
            ref={index === currentIndex ? activeButtonRef : null}
            onClick={() => onImageSelect(index)}
            className={`relative flex-shrink-0 rounded-xl overflow-hidden transition-all duration-300 ease-out ${
              index === currentIndex
                ? "w-16 h-16 ring-2 ring-white/50 shadow-lg scale-110"
                : "w-12 h-12 ring-1 ring-white/20 hover:ring-white/40 hover:scale-105 active:scale-95"
            }`}
            aria-label={`Go to image ${index + 1}: ${image.title}`}
          >
            <Image
              src={image.src}
              alt={image.title}
              fill
              loading="lazy"
              sizes="64px"
              className="object-cover"
              placeholder={image.blurDataURL ? "blur" : "empty"}
              blurDataURL={image.blurDataURL}
            />
            {/* Current image overlay */}
            {index === currentIndex && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
            )}
            {/* Active indicator dot */}
            {index === currentIndex && (
              <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-white/80 rounded-full shadow-sm" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
