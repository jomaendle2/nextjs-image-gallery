import { ChevronLeft, ChevronRight } from "lucide-react";

interface CarouselNavigationProps {
  onNext: () => void;
  onPrevious: () => void;
  canGoNext: boolean;
  canGoPrevious: boolean;
}

export function CarouselNavigation({
  onNext,
  onPrevious,
  canGoNext,
  canGoPrevious,
}: CarouselNavigationProps) {
  return (
    <>
      {/* Previous button */}
      <button
        className={`absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 z-20 grid place-items-center size-12 sm:size-14 rounded-full glass-thin transition-[transform,background-color,opacity] duration-300 ease-glass ${
          canGoPrevious
            ? "hover:bg-[var(--glass-fill-hover)] hover:scale-105 active:scale-95 opacity-100"
            : "opacity-30 cursor-not-allowed"
        }`}
        disabled={!canGoPrevious}
        onClick={onPrevious}
        aria-label="Previous image"
        type="button"
      >
        <ChevronLeft
          className="size-5 sm:size-6 text-white"
          strokeWidth={2.25}
        />
      </button>

      {/* Next button */}
      <button
        className={`absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 z-20 grid place-items-center size-12 sm:size-14 rounded-full glass-thin transition-[transform,background-color,opacity] duration-300 ease-glass ${
          canGoNext
            ? "hover:bg-[var(--glass-fill-hover)] hover:scale-105 active:scale-95 opacity-100"
            : "opacity-30 cursor-not-allowed"
        }`}
        disabled={!canGoNext}
        onClick={onNext}
        aria-label="Next image"
        type="button"
      >
        <ChevronRight
          className="size-5 sm:size-6 text-white"
          strokeWidth={2.25}
        />
      </button>
    </>
  );
}
