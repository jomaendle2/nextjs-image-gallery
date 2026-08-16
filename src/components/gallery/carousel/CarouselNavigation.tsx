import { ChevronLeft, ChevronRight } from "lucide-react";
import { GlassButton } from "@/components/ui/glass-button";

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
      <GlassButton
        aria-label="Previous image"
        className={`-translate-y-1/2 absolute left-4 sm:left-6 top-1/2 z-20 transition-opacity sm:size-14 ${
          canGoPrevious
            ? "opacity-100 hover:scale-105"
            : "cursor-not-allowed opacity-30"
        }`}
        disabled={!canGoPrevious}
        onClick={onPrevious}
        size="icon"
        variant="icon"
      >
        <ChevronLeft
          className="size-5 sm:size-6 text-white"
          strokeWidth={2.25}
        />
      </GlassButton>

      {/* Next button */}
      <GlassButton
        aria-label="Next image"
        className={`-translate-y-1/2 absolute right-4 sm:right-6 top-1/2 z-20 transition-opacity sm:size-14 ${
          canGoNext
            ? "opacity-100 hover:scale-105"
            : "cursor-not-allowed opacity-30"
        }`}
        disabled={!canGoNext}
        onClick={onNext}
        size="icon"
        variant="icon"
      >
        <ChevronRight
          className="size-5 sm:size-6 text-white"
          strokeWidth={2.25}
        />
      </GlassButton>
    </>
  );
}
