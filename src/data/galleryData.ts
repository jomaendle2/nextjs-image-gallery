import type { PhotoExif } from "@/lib/photos/derive";
import { toGalleryImage } from "@/lib/photos/map";
import { listPublishedPhotos } from "@/lib/photos/repository";

export interface GalleryAuthor {
  slug: string;
  name: string;
  siteUrl: string | null;
}

export interface GalleryImage {
  /** nanoid; doubles as the key the `image_views` table is written against. */
  id: string;
  /**
   * Shaped exactly like a static import, because that is all next/image ever
   * needed: a `src`, the intrinsic dimensions to reserve the right aspect
   * ratio, and a `blurDataURL` for the placeholder. Building this object from
   * a database row is what lets every component below consume a contributed
   * photo without knowing it did not come from `src/assets`.
   */
  src: { src: string; width: number; height: number; blurDataURL: string };
  title: string;
  description: string;
  bgColor: string;
  location: string | null;
  exif: PhotoExif | null;
  author: GalleryAuthor;
}

/**
 * The gallery feed: the pinned opener first, then newest published first.
 * Pass a contributor slug to narrow it to one photographer.
 *
 * A failure here renders an empty gallery rather than a 500 — a photo site
 * that shows nothing is bad, but one that shows an error page is worse.
 */
export async function getGalleryImages(
  authorSlug?: string,
): Promise<GalleryImage[]> {
  try {
    const rows = await listPublishedPhotos(authorSlug);
    return rows.map(toGalleryImage);
  } catch (error) {
    console.error("Failed to load gallery images:", error);
    return [];
  }
}
