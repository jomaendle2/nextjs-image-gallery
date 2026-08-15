"use client";

import { ViewCount } from "@/components/gallery/ViewCount";
import type { GalleryImage } from "@/data/galleryData";

/**
 * The wall label at the foot of the full-screen viewer.
 *
 * Title, description and view count on one glass card. It lives apart from
 * `ImageModal` because it is the piece that grows — it is where a details
 * panel, and later a location block, attach — while the modal around it is
 * finished behaviour that should stop changing.
 *
 * `chrome` carries the shared enter/exit animation class; see
 * `ViewerControls` for why the modal owns that rather than each piece.
 */
export function ViewerCaption({
  image,
  chrome,
}: {
  image: GalleryImage;
  chrome: string;
}) {
  return (
    <div className={`absolute right-4 bottom-4 left-4 z-10 ${chrome}`}>
      <div className="glass-thick mx-auto max-w-md rounded-[20px] px-4 py-3.5">
        <h2 className="mb-1 font-semibold text-base text-white tracking-[-0.02em]">
          {image.title}
        </h2>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[0.8125rem] text-white/65 leading-relaxed">
            {image.description}
          </p>
          <ViewCount
            className="text-white/80"
            imageId={image.id}
            shouldIncrement={false}
            variant="modal"
          />
        </div>
      </div>
    </div>
  );
}
