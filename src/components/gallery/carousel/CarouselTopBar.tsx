import { Grid3x3 } from "lucide-react";
import { GlassButton } from "@/components/ui/glass-button";

interface CarouselTopBarProps {
  currentIndex: number;
  totalImages: number;
  onViewModeChange: () => void;
}

export function CarouselTopBar({
  currentIndex,
  totalImages,
  onViewModeChange,
}: CarouselTopBarProps) {
  return (
    <div className="absolute top-6 left-6 right-6 z-20 flex justify-between items-center">
      <div className="text-gallery-text/80 text-sm font-medium">
        {currentIndex + 1} of {totalImages}
      </div>
      <GlassButton
        variant="icon"
        onClick={onViewModeChange}
        className="hover:scale-105 transition-transform duration-200"
      >
        <Grid3x3 size={20} />
      </GlassButton>
    </div>
  );
}
