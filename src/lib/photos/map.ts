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
    /*
     * The coarse pair only, folded into one object so a component can ask
     * "is there a pin?" rather than checking that two numbers agree about
     * existing.
     *
     * The exact pair is not in `PhotoRow` at all, so there is nothing here
     * to pass through by accident — the gate is the shape of the type rather
     * than a rule about this function. A test asserts this file names no
     * exact column, which is the version of that a rename cannot break.
     */
    pin:
      row.coarse_lat === null || row.coarse_lng === null
        ? null
        : { lat: row.coarse_lat, lng: row.coarse_lng },
    hasMemberDetails: row.has_member_details,
    publishedAt: row.published_at,
    author: {
      slug: row.author_slug,
      name: row.author_name,
      siteUrl: row.author_site_url,
    },
  };
}
