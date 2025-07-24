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
        onClick={onPrevious}
        disabled={!canGoPrevious}
        className={`absolute left-6 top-1/2 -translate-y-1/2 z-10 p-4 rounded-full bg-black/30 backdrop-blur-xl border border-white/15 transition-all duration-300 ease-out shadow-lg ${
          canGoPrevious
            ? "hover:bg-black/50 hover:scale-105 hover:shadow-xl active:scale-95 opacity-100"
            : "opacity-40 cursor-not-allowed"
        }`}
        aria-label="Previous image"
      >
        <ChevronLeft className="w-6 h-6 text-white" strokeWidth={2.5} />
      </button>

      {/* Next button */}
      <button
        onClick={onNext}
        disabled={!canGoNext}
        className={`absolute right-6 top-1/2 -translate-y-1/2 z-10 p-4 rounded-full bg-black/30 backdrop-blur-xl border border-white/15 transition-all duration-300 ease-out shadow-lg ${
          canGoNext
            ? "hover:bg-black/50 hover:scale-105 hover:shadow-xl active:scale-95 opacity-100"
            : "opacity-40 cursor-not-allowed"
        }`}
        aria-label="Next image"
      >
        <ChevronRight className="w-6 h-6 text-white" strokeWidth={2.5} />
      </button>
    </>
  );
}
