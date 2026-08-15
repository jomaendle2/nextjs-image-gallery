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
      className={`relative flex-shrink-0 overflow-hidden transition-[width,height,box-shadow,opacity] duration-400 ease-glass ${
        isActive
          ? "size-[58px] rounded-[15px] shadow-[0_0_0_2px_oklch(100%_0_0_/_0.9),0_6px_18px_-6px_oklch(0%_0_0_/_0.7)] opacity-100"
          : "size-11 rounded-xl opacity-65 shadow-[0_0_0_1px_oklch(100%_0_0_/_0.22)] hover:opacity-100 hover:shadow-[0_0_0_1px_oklch(100%_0_0_/_0.5)] active:scale-95"
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
      {/* Specular sheen so the active tile reads as lit glass, not a border. */}
      {isActive ? (
        <div className="absolute inset-0 bg-gradient-to-b from-white/25 via-transparent to-black/25" />
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
        className="flex items-center gap-2.5 px-3 h-[86px] glass-regular rounded-[22px] max-w-full overflow-x-auto scrollbar-hide"
        ref={containerRef}
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
