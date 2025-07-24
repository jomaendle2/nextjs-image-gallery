import { ChevronLeft, ChevronRight } from "lucide-react";
import { GlassButton } from "@/components/ui/glass-button";

interface CarouselNavigationProps {
  onPrevious: () => void;
  onNext: () => void;
  isTransitioning: boolean;
}

export function CarouselNavigation({
  onPrevious,
  onNext,
  isTransitioning,
}: CarouselNavigationProps) {
  return (
    <>
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
        <GlassButton
          variant="icon"
          onClick={onPrevious}
          className="hover:scale-105 transition-transform duration-200"
          disabled={isTransitioning}
        >
          <ChevronLeft size={24} />
        </GlassButton>
      </div>

      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
        <GlassButton
          variant="icon"
          onClick={onNext}
          className="hover:scale-105 transition-transform duration-200"
          disabled={isTransitioning}
        >
          <ChevronRight size={24} />
        </GlassButton>
      </div>
    </>
  );
}
