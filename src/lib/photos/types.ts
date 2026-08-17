import type { PhotoExif } from "./derive";

/**
 * A point a photographer marked, at whatever precision the holder is
 * entitled to. Both halves of a pin have this shape; which one you are
 * looking at is a property of the query that fetched it.
 */
export interface Pin {
  lat: number;
  lng: number;
}

/**
 * A published photo joined to its author, shaped as the database returns it.
 * Columns stay `snake_case` all the way to `toGalleryImage`, which is the one
 * place the rename happens.
 */
export interface PhotoRow {
  id: string;
  /** Already COALESCEd to the display copy by the query. */
  blob_url: string;
  width: number;
  height: number;
  blur_data_url: string;
  bg_color: string;
  title: string;
  description: string;
  location: string | null;
  exif: PhotoExif | null;
  /** ISO timestamp. Never null here — the query selects published rows only. */
  published_at: string;
  author_slug: string;
  author_name: string;
  author_site_url: string | null;
  /**
   * The public half of a pin: the centre of a cell about 100 km across, or
   * null if the photographer marked nothing.
   *
   * The exact pair is deliberately absent, exactly as `precise_location` is.
   * This is what a page's payload may carry, so it is what this row type is
   * allowed to name.
   */
  coarse_lat: number | null;
  coarse_lng: number | null;
}

/**
 * One published photograph with a pin, as `/globe` needs it.
 *
 * Five fields, and no blur placeholder or dimensions: the globe draws dots
 * and lists links, so anything shaped like a thumbnail would reintroduce the
 * per-photograph payload cost that `docs/next-version.md` §2 already tracks.
 * Only the coarse pair, which is the whole reason a public globe is possible.
 */
export interface GlobePointRow {
  id: string;
  title: string;
  location: string | null;
  coarse_lat: number;
  coarse_lng: number;
  author_slug: string;
}

/** What a contributor sees on their own dashboard, drafts included. */
export interface OwnPhotoRow {
  id: string;
  blob_url: string;
  width: number;
  height: number;
  blur_data_url: string;
  bg_color: string;
  title: string;
  description: string;
  location: string | null;
  exif: PhotoExif | null;
  published_at: string | null;
  is_opener: boolean;
  precise_location: string | null;
  technique: string | null;
  /**
   * Both halves of the pin, because this is the photographer's own editor:
   * they are entitled to see the point they marked, and to be shown the
   * blunt version that goes with it before they decide to keep either.
   */
  precise_lat: number | null;
  precise_lng: number | null;
  coarse_lat: number | null;
  coarse_lng: number | null;
  /** Offered as the public example on `/membership`. */
  is_specimen: boolean;
  author_id: string;
  author_name: string;
  author_slug: string;
}

export interface DraftPhotoInput {
  blob_url: string;
  blob_pathname: string;
  display_url: string;
  display_pathname: string;
  width: number;
  height: number;
  blur_data_url: string;
  bg_color: string;
  exif: PhotoExif | null;
  author_id: string;
}

export interface PublishInput {
  title: string;
  description: string;
  location: string | null;
  bg_color: string;
  /** Member-only. Typed by the photographer, never read from the file. */
  precise_location: string | null;
  /** Member-only. How the photograph was made. */
  technique: string | null;
  /**
   * Where the photographer marked, or null to clear the pin entirely.
   *
   * One point in, two stored: `publishPhoto` runs it through `coarsen()`
   * itself rather than accepting a coarse pair from the caller, so the two
   * precisions cannot be made to disagree — a caller cannot submit an exact
   * point in the Alps with a public dot in the Atlantic.
   *
   * `publicOnly` is a photographer keeping the globe and giving up the exact
   * point: the coarse pair is written and the precise pair stays null, so
   * there is nothing behind the paywall to leak. Somebody whose subject is a
   * nest or a rare plant can join the map without telling anybody where it is.
   */
  pin: { point: Pin; publicOnly: boolean } | null;
  /**
   * Consent for the two fields above to be shown publicly on `/membership`.
   * At most one photograph holds this; setting it clears the others.
   */
  is_specimen: boolean;
}
