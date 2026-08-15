import type { PhotoExif } from "./derive";

/**
 * A published photo joined to its author, shaped as the database returns it.
 * Columns stay `snake_case` all the way to `toGalleryImage`, which is the one
 * place the rename happens.
 */
export interface PhotoRow {
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
  author_id: string;
  author_name: string;
  author_slug: string;
}

export interface DraftPhotoInput {
  blob_url: string;
  blob_pathname: string;
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
}
