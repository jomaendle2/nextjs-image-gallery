import type { PhotoExif } from "./derive";

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
   * Consent for the two fields above to be shown publicly on `/membership`.
   * At most one photograph holds this; setting it clears the others.
   */
  is_specimen: boolean;
}
