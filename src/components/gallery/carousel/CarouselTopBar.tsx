import { X } from "lucide-react";

interface CarouselTopBarProps {
  onClose?: () => void;
}

export function CarouselTopBar({ onClose }: CarouselTopBarProps) {
  return (
    <div className="flex-shrink-0 flex justify-between items-center p-6">
      {onClose ? (
        <button
          onClick={onClose}
          className="grid place-items-center size-11 rounded-full glass-thin transition-[transform,background-color] duration-300 ease-glass hover:bg-[var(--glass-fill-hover)] hover:scale-105 active:scale-95"
          aria-label="Close gallery"
          type="button"
        >
          <X className="size-5 text-white" strokeWidth={2.25} />
        </button>
      ) : null}
    </div>
  );
}
