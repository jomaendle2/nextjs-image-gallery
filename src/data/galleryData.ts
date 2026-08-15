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
  /** ISO timestamp of publication. What the feed orders and dates by. */
  publishedAt: string;
  author: GalleryAuthor;
}

/**
 * The gallery feed: the pinned opener first, then newest published first.
 * Pass a contributor slug to narrow it to one photographer.
 *
 * Throws. Callers choose what a failure means, because it does not mean the
 * same thing everywhere — see `getGalleryImages` below.
 */
export async function listGalleryImages(
  authorSlug?: string,
): Promise<GalleryImage[]> {
  const rows = await listPublishedPhotos(authorSlug);
  return rows.map(toGalleryImage);
}

/**
 * The same, but an empty gallery rather than an error page.
 *
 * Correct for the pages that *display* a gallery: a photo site showing
 * nothing is bad, one showing a stack trace is worse.
 *
 * Emphatically not correct anywhere the result is used to decide whether
 * something exists. Every consumer here is cached for an hour, so a single
 * failed query during revalidation used to be baked in for that hour: a
 * valid `/photo/<id>` became `notFound()` and was cached as a 404, the feed
 * published a channel with no items, and the sitemap dropped every
 * photograph — which a crawler reads as deletion. An exception is retried
 * and never cached, which is precisely why those callers now let it through.
 */
export async function getGalleryImages(
  authorSlug?: string,
): Promise<GalleryImage[]> {
  try {
    return await listGalleryImages(authorSlug);
  } catch (error) {
    console.error("Failed to load gallery images:", error);
    return [];
  }
}
