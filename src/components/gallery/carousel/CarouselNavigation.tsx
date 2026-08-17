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
  /*
   * Not on a phone.
   *
   * These are 48px discs pinned 16px from each edge, and at 390px wide the
   * photograph runs from x=24 to x=366 — so both arrows sit on top of the
   * picture, one over each side of it, on the screen where the picture has the
   * least room to begin with. They are also the least necessary control there:
   * the strip swipes (`scrollLeft` moves a full page per gesture), and the
   * dock below shows every photograph and jumps to any of them. Nothing is
   * lost by hiding them and the photograph gets its edges back.
   *
   * `hidden sm:flex` rather than dropping the markup, so the arrows are simply
   * absent on a phone and unchanged everywhere else — and `sm:flex` because
   * that is the display `GlassButton` resolves to, which `hidden` would
   * otherwise have overridden for good.
   */
  return (
    <>
      {/* Previous button */}
      <GlassButton
        aria-label="Previous image"
        className={`-translate-y-1/2 absolute left-4 sm:left-6 top-1/2 z-20 hidden transition-opacity sm:flex sm:size-14 ${
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
        className={`-translate-y-1/2 absolute right-4 sm:right-6 top-1/2 z-20 hidden transition-opacity sm:flex sm:size-14 ${
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
