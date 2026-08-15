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
          ? "size-[52px] rounded-[13px] shadow-[0_0_0_1.5px_oklch(100%_0_0_/_0.9),0_8px_22px_-8px_oklch(0%_0_0_/_0.8)] opacity-100"
          : "size-9 rounded-[10px] opacity-45 shadow-[0_0_0_1px_oklch(100%_0_0_/_0.18)] hover:opacity-90 hover:shadow-[0_0_0_1px_oklch(100%_0_0_/_0.45)] active:scale-95"
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

  /*
   * No panel behind the strip. The glass slab was the single most
   * template-looking element on the page, and it added a competing surface
   * between the photograph and its own thumbnails. Bare tiles on the colour
   * field read as a contact strip instead.
   */
  return (
    <div className="flex justify-center">
      <div
        className="flex max-w-full items-center gap-2 overflow-x-auto px-1 py-2 scrollbar-hide"
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
