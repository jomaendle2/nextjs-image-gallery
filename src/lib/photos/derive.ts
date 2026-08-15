import exifr from "exifr";
import sharp from "sharp";

/**
 * The exposure facts a photographer expects to see credited alongside their
 * work. Deliberately a small, closed set — see EXIF_PICK below.
 */
export interface PhotoExif {
  camera?: string;
  lens?: string;
  focal_length?: string;
  aperture?: string;
  shutter?: string;
  iso?: number;
  taken_at?: string;
}

/**
 * Everything a static import used to give us at build time, recovered at
 * upload time instead. Without `width`/`height` next/image cannot reserve the
 * right aspect ratio, and without `blur_data_url` there is no placeholder.
 */
export interface DerivedPhoto {
  width: number;
  height: number;
  blur_data_url: string;
  bg_color: string;
  exif: PhotoExif | null;
}

/** Matches the placeholder width next/image generates for static imports. */
const BLUR_WIDTH = 8;
const BLUR_QUALITY = 40;
const RGB_MAX = 255;
const HEX_RADIX = 16;
const ONE_SECOND = 1;

/**
 * Two independent layers keep location data out of the database.
 *
 * First, the GPS IFD is never parsed: `gps: false` means those bytes are not
 * even decoded, and the sibling blocks that can also carry coordinates (XMP,
 * IPTC, the embedded thumbnail's own EXIF) are off for the same reason.
 * Second, `buildExif` copies across a fixed set of named fields, so anything
 * that did somehow appear in the parse result still cannot reach a column.
 *
 * `reviveValues: false` keeps `DateTimeOriginal` as the camera's raw string.
 * EXIF stores no timezone, so letting the parser produce a `Date` would
 * silently stamp it with the importing machine's offset.
 */
export const EXIF_OPTIONS = {
  exif: true,
  gps: false,
  xmp: false,
  iptc: false,
  icc: false,
  interop: false,
  // The embedded thumbnail is its own IFD with its own tags.
  ifd1: false,
  // Some bodies write a second copy of the coordinates in here.
  makerNote: false,
  userComment: false,
  reviveValues: false,
} as const;

/** `2026:04:11 08:32:10` — the EXIF wall-clock format, with no zone. */
const EXIF_DATE = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}:\d{2}:\d{2})$/;

function toHex(value: number): string {
  return Math.max(0, Math.min(RGB_MAX, Math.round(value)))
    .toString(HEX_RADIX)
    .padStart(2, "0");
}

function formatShutter(seconds: number): string {
  if (seconds >= ONE_SECOND) {
    return `${seconds} s`;
  }
  return `1/${Math.round(1 / seconds)} s`;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function buildExif(raw: Record<string, unknown>): PhotoExif | null {
  const exif: PhotoExif = {};

  const camera = [asString(raw["Make"]), asString(raw["Model"])]
    .filter(Boolean)
    .join(" ");
  if (camera !== "") {
    exif.camera = camera;
  }

  const lens = asString(raw["LensModel"]);
  if (lens !== undefined) {
    exif.lens = lens;
  }

  const focal = asNumber(raw["FocalLength"]);
  if (focal !== undefined) {
    exif.focal_length = `${Math.round(focal)} mm`;
  }

  const aperture = asNumber(raw["FNumber"]);
  if (aperture !== undefined) {
    exif.aperture = `f/${aperture}`;
  }

  const shutter = asNumber(raw["ExposureTime"]);
  if (shutter !== undefined && shutter > 0) {
    exif.shutter = formatShutter(shutter);
  }

  const iso = asNumber(raw["ISO"]);
  if (iso !== undefined) {
    exif.iso = iso;
  }

  const taken = asString(raw["DateTimeOriginal"])?.match(EXIF_DATE);
  if (taken) {
    exif.taken_at = `${taken[1]}-${taken[2]}-${taken[3]} ${taken[4]}`;
  }

  return Object.keys(exif).length > 0 ? exif : null;
}

async function readExif(buffer: Buffer): Promise<PhotoExif | null> {
  let raw: unknown;
  try {
    raw = await exifr.parse(buffer, EXIF_OPTIONS);
  } catch {
    // A photo with unreadable EXIF is still a perfectly good photo.
    return null;
  }
  if (raw === null || typeof raw !== "object") {
    return null;
  }
  return buildExif(raw as Record<string, unknown>);
}

/**
 * Reads an uploaded photo once and returns everything the gallery needs to
 * render it. Throws if the buffer is not a decodable image, which is what
 * the upload route turns into a 422 (after deleting the orphaned blob).
 */
export async function deriveFromBuffer(buffer: Buffer): Promise<DerivedPhoto> {
  const image = sharp(buffer, { failOn: "error" });

  const { width, height } = await image.metadata();
  if (
    width === undefined ||
    height === undefined ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error("Could not read the image dimensions.");
  }

  const [blur, stats, exif] = await Promise.all([
    image
      .clone()
      .resize(BLUR_WIDTH, null, { fit: "inside" })
      .webp({ quality: BLUR_QUALITY })
      .toBuffer(),
    image.clone().stats(),
    readExif(buffer),
  ]);

  const { dominant } = stats;

  return {
    width,
    height,
    blur_data_url: `data:image/webp;base64,${blur.toString("base64")}`,
    bg_color: `#${toHex(dominant.r)}${toHex(dominant.g)}${toHex(dominant.b)}`,
    exif,
  };
}
