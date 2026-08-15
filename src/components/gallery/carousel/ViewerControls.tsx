"use client";

import { ZoomIn, ZoomOut } from "lucide-react";
import { GlassButton } from "@/components/ui/glass-button";

/**
 * The viewer's control cluster, top left.
 *
 * Pulled out of `ImageModal` so that component is about the overlay — focus,
 * scroll lock, the enter and exit choreography — rather than about buttons.
 * The cluster is also the place new controls land, so it is the part most
 * likely to keep growing; giving it its own file means it can grow without
 * pushing the modal's actual logic further apart.
 *
 * `chrome` is the enter/exit animation class the whole chrome layer shares.
 * It is passed in rather than derived here because the modal owns the timing:
 * every piece of chrome must arrive and leave on the same frame.
 */
export function ViewerControls({
  chrome,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  chrome: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  return (
    <div className={`absolute top-4 left-4 z-10 flex gap-2 ${chrome}`}>
      <GlassButton
        aria-label="Zoom in"
        className="rounded-full p-2"
        onClick={onZoomIn}
      >
        <ZoomIn size={20} />
      </GlassButton>
      <GlassButton
        aria-label="Zoom out"
        className="rounded-full p-2"
        onClick={onZoomOut}
      >
        <ZoomOut size={20} />
      </GlassButton>
      <GlassButton
        aria-label="Reset view"
        className="rounded-full px-3 py-2"
        onClick={onReset}
      >
        Reset
      </GlassButton>
    </div>
  );
}
