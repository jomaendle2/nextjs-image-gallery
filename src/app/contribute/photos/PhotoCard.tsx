import Image from "next/image";
import type { PhotoExif } from "@/lib/photos/derive";
import type { OwnPhotoRow } from "@/lib/photos/types";
import { PhotoEditForm } from "./PhotoEditForm";

/**
 * One photograph in the contributor's dashboard: what it is, beside what can
 * be done to it.
 *
 * The card is the shell only — the thumbnail, the dimensions, the camera
 * line. Everything with state lives in `PhotoEditForm`, which is why this
 * file has no hooks and no "use client": it renders on the server and the
 * interactive half is the only thing shipped to the browser.
 */

function exifSummary(exif: PhotoExif | null): string | null {
  if (!exif) {
    return null;
  }
  const parts = [
    exif.camera,
    exif.lens,
    exif.focal_length,
    exif.aperture,
    exif.shutter,
    exif.iso === undefined ? undefined : `ISO ${exif.iso}`,
  ].filter((part): part is string => part !== undefined);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function PhotoCard({ photo }: { photo: OwnPhotoRow }) {
  const exif = exifSummary(photo.exif);

  return (
    <li className="glass-thin rounded-3xl p-5">
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="sm:w-[200px] sm:shrink-0">
          {/*
            Fixed 4:3 box. Left to its own aspect ratio, a portrait original
            made its row three times taller than a landscape one and the list
            became impossible to scan.
          */}
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-white/5">
            <Image
              alt={photo.title === "" ? "Uploaded photograph" : photo.title}
              blurDataURL={photo.blur_data_url}
              className="object-cover"
              fill={true}
              placeholder="blur"
              sizes="(max-width: 640px) 100vw, 200px"
              src={photo.blob_url}
            />
          </div>
          <p className="mt-2 text-white/40 text-xs tabular-nums">
            {photo.width} × {photo.height}
          </p>
          {exif === null ? null : (
            <p className="mt-1 text-pretty text-white/40 text-xs">{exif}</p>
          )}
        </div>

        <PhotoEditForm photo={photo} />
      </div>
    </li>
  );
}
