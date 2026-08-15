import { X } from "lucide-react";

interface CarouselTopBarProps {
  onClose?: () => void;
}

export function CarouselTopBar({ onClose }: CarouselTopBarProps) {
  /*
   * Nothing to show without a close handler. This used to render an empty
   * `p-6` box regardless, costing 72px of dead space at the top of every page
   * and pushing the contributor header out of line with the grid's.
   */
  if (!onClose) {
    return null;
  }

  return (
    <div className="flex flex-shrink-0 items-center justify-between p-6">
      {onClose ? (
        <button
          onClick={onClose}
          className="grid place-items-center size-11 rounded-full glass-thin transition-[scale,background-color] duration-300 ease-glass hover:bg-[var(--glass-fill-hover)] hover:scale-105 active:scale-95"
          aria-label="Close gallery"
          type="button"
        >
          <X className="size-5 text-white" strokeWidth={2.25} />
        </button>
      ) : null}
    </div>
  );
}
