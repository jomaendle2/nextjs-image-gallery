import { X } from "lucide-react";
import { glassControl } from "@/components/ui/glass-button";

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
          /* A Link out of the viewer, so not a button. */
          className={glassControl("size-11 hover:scale-105", "round")}
          aria-label="Close gallery"
          type="button"
        >
          <X className="size-5 text-white" strokeWidth={2.25} />
        </button>
      ) : null}
    </div>
  );
}
