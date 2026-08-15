import Image from "next/image";
import { memo, useEffect, useRef } from "react";
import type { GalleryImage } from "@/data/galleryData";

interface ThumbnailProps {
  image: GalleryImage;
  index: number;
  isActive: boolean;
  onSelect: (index: number) => void;
}

/**
 * Split out and memoized so that changing the current index re-renders the
 * two thumbnails whose state actually changed instead of all fourteen, and
 * so the click handler is a stable per-thumbnail callback rather than a new
 * closure allocated on every parent render.
 */
const Thumbnail = memo(function ThumbnailButton({
  image,
  index,
  isActive,
  onSelect,
}: ThumbnailProps) {
  const handleClick = () => {
    onSelect(index);
  };

  return (
    <button
      aria-current={isActive}
      aria-label={`Go to image ${index + 1}: ${image.title}`}
      className={`relative flex-shrink-0 rounded-xl overflow-hidden transition-all duration-300 ease-out ${
        isActive
          ? "w-16 h-16 ring-2 ring-white/50 shadow-lg scale-110"
          : "w-12 h-12 ring-1 ring-white/20 hover:ring-white/40 hover:scale-105 active:scale-95"
      }`}
      onClick={handleClick}
      type="button"
    >
      <Image
        alt=""
        className="object-cover"
        fill={true}
        loading="lazy"
        placeholder="blur"
        sizes="64px"
        src={image.src}
      />
      {isActive ? (
        <>
          {/* Current image overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          {/* Active indicator dot */}
          <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-white/80 rounded-full shadow-sm" />
        </>
      ) : null}
    </button>
  );
});

interface ImageIndicatorsProps {
  images: readonly GalleryImage[];
  currentIndex: number;
  onImageSelect: (index: number) => void;
}

export function ImageIndicators({
  images,
  currentIndex,
  onImageSelect,
}: ImageIndicatorsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep the active thumbnail in view. Reading the button out of the
  // container by index means the effect genuinely depends on currentIndex,
  // instead of depending on a ref that silently changed underneath it.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const activeButton = container.children[currentIndex];
    if (!(activeButton instanceof HTMLElement)) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();

    const isButtonVisible =
      buttonRect.left >= containerRect.left &&
      buttonRect.right <= containerRect.right;

    if (isButtonVisible) {
      return;
    }

    // Centre the active button within the strip.
    const buttonCenter = activeButton.offsetLeft + activeButton.offsetWidth / 2;
    const containerCenter = container.offsetWidth / 2;

    container.scrollTo({
      left: buttonCenter - containerCenter,
      behavior: "smooth",
    });
  }, [currentIndex]);

  return (
    <div className="flex justify-center pb-4">
      <div
        className="flex items-center gap-3 p-3 h-[90px] bg-black/20 backdrop-blur-xl rounded-2xl border border-white/10 max-w-full overflow-x-auto scrollbar-hide shadow-lg"
        ref={containerRef}
        style={{
          WebkitBackdropFilter: "blur(24px)",
          backdropFilter: "blur(24px)",
          isolation: "isolate",
        }}
      >
        {images.map((image, index) => (
          <Thumbnail
            image={image}
            index={index}
            isActive={index === currentIndex}
            key={image.id}
            onSelect={onImageSelect}
          />
        ))}
      </div>
    </div>
  );
}
