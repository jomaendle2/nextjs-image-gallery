import type { PhotoExif } from "./derive";

/**
 * The exposure line: camera, lens, focal length, aperture, shutter, ISO.
 *
 * Its own module, and that is the whole point of the file. The dashboard and
 * the viewer had byte-identical copies of this, so sharing it was right — but
 * the obvious home, `derive.ts` beside the `PhotoExif` type, imports `sharp`
 * and `exifr`. Both callers are `"use client"`, so importing from there
 * dragged libvips into the browser bundle and the whole site answered 500
 * with `Can't resolve 'child_process'`.
 *
 * A type-only import of `PhotoExif` is safe: it is erased at compile time and
 * pulls nothing in with it.
 *
 * Returns null when there is nothing to say, which both callers need in order
 * to hold the line's height without printing a stray separator.
 */
export function exifLine(exif: PhotoExif | null): string | null {
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
