import { X } from "lucide-react";

interface CarouselTopBarProps {
  currentIndex: number;
  totalImages: number;
  onClose?: () => void;
}

export function CarouselTopBar({
  currentIndex,
  totalImages,
  onClose,
}: CarouselTopBarProps) {
  return (
    <div className="flex-shrink-0 flex justify-between items-center p-6 bg-gradient-to-b from-black/60 via-black/30 to-transparent">
      <div className="text-white/90 font-medium text-sm tracking-wide">
        {currentIndex + 1} of {totalImages}
      </div>

      {onClose && (
        <button
          onClick={onClose}
          className="p-3 rounded-full bg-black/30 backdrop-blur-xl border border-white/15 hover:bg-black/50 transition-all duration-300 ease-out hover:scale-105 active:scale-95 shadow-lg"
          aria-label="Close gallery"
        >
          <X className="w-5 h-5 text-white" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
