import { X } from "lucide-react";

interface CarouselTopBarProps {
  onClose?: () => void;
}

export function CarouselTopBar({ onClose }: CarouselTopBarProps) {
  return (
    <div className="flex-shrink-0 flex justify-between items-center p-6">
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
