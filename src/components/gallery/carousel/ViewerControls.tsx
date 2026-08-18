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
 *
 * The cluster is pinned to the corner by a wrapper rather than by `top-4
 * left-4` on the buttons themselves, because the page ships `viewport-fit:
 * cover` and a fixed 16px puts these under the notch. `safe-t-4`/`safe-x-4`
 * are padding utilities — the same ones `GalleryTopBar` uses one layer up —
 * so they need something to pad that is not a button whose own padding sets
 * its 44px hit area. The wrapper is that something, and it is transparent to
 * pointers so the gap beside the buttons still dismisses the viewer.
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
    <div
      className={`pointer-events-none absolute top-0 left-0 z-10 safe-x-4 safe-t-4 ${chrome}`}
    >
      <div className="pointer-events-auto flex gap-2">
        <GlassButton aria-label="Zoom in" size="icon" onClick={onZoomIn}>
          <ZoomIn size={20} />
        </GlassButton>
        <GlassButton aria-label="Zoom out" size="icon" onClick={onZoomOut}>
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
    </div>
  );
}
