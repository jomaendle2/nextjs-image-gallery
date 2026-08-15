import type { GalleryImage } from "@/data/galleryData";
import type { PhotoRow } from "./types";

/**
 * The single crossing point between the database's `snake_case` columns and
 * the camel-cased props the components use. Keeping it in one function is
 * what allows `useNamingConvention` to stay off for row types without the
 * convention leaking into the UI.
 */
export function toGalleryImage(row: PhotoRow): GalleryImage {
  return {
    id: row.id,
    src: {
      src: row.blob_url,
      width: row.width,
      height: row.height,
      blurDataURL: row.blur_data_url,
    },
    title: row.title,
    description: row.description,
    bgColor: row.bg_color,
    location: row.location,
    exif: row.exif,
    author: {
      slug: row.author_slug,
      name: row.author_name,
      siteUrl: row.author_site_url,
    },
  };
}
