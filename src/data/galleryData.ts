import { cache } from "react";
import type { PhotoExif } from "@/lib/photos/derive";
import { toGalleryImage } from "@/lib/photos/map";
import { listPublishedPhotos } from "@/lib/photos/repository";

/**
 * The public half of a photographer's pin, if they marked one.
 *
 * The centre of a cell about a kilometre across — `coarsen.ts` explains why the
 * cells are equal-ground-width rather than rounded degrees. Roughly forty
 * bytes per photograph against a measured 5.4 KB, which is what makes it
 * affordable in the payload of every gallery page rather than behind a
 * request of its own.
 */
export interface GalleryPin {
  lat: number;
  lng: number;
}

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
  /** Where the photographer marked, blurred to a ~1 km cell. */
  pin: GalleryPin | null;
  /**
   * Whether this photograph has member-only notes behind it.
   *
   * One bit, and the only thing a public payload learns about the paid
   * fields — computed by the database, never by a query naming them. It
   * exists so the viewer can offer the membership where there is something
   * to buy and stay quiet where there is not; before it, the offer appeared
   * under every photograph including the ones with an empty shelf.
   *
   * Not a substitute for the gate. It says *that* something exists, so
   * nothing here decides who may read it — `/api/photo/[id]/details` still
   * does, and deleting the component that shows the content would still
   * expose nothing.
   */
  hasMemberDetails: boolean;
  /** ISO timestamp of publication. What the feed orders and dates by. */
  publishedAt: string;
  author: GalleryAuthor;
}

/**
 * The gallery feed: the pinned opener first, then newest published first.
 * Pass a contributor slug to narrow it to one photographer.
 *
 * Throws, and every caller lets it. There used to be a second, swallowing
 * variant for the pages that *display* a gallery, on the reasoning that a
 * photo site showing nothing beats one showing a stack trace. That reasoning
 * was wrong in a way nobody could see: every consumer is cached for an hour,
 * and returning `[]` makes the failure look like a *successful* render of an
 * empty gallery. Next then caches "there is nothing here" and serves it to
 * everyone until the hour is out — one Neon hiccup during revalidation, and
 * the front page is blank until 3 a.m. The site does not look broken, it
 * looks empty, so nothing alerts and nobody reports it.
 *
 * A throw is strictly better because Next does not cache it: "if an error is
 * thrown while attempting to revalidate data, the last successfully
 * generated data will continue to be served from the cache", and the next
 * request retries — so the visible result of a transient failure is the
 * previous good page, and the failure is confined to a first render, where
 * `error.tsx` offers a retry. The same property is why the sitemap, the
 * feeds and `/photo/[id]` were converted first: an empty sitemap reads as
 * deletion, and a missing row as a 404, both cached for the hour.
 *
 * `EmptyGallery` stays, and now means what it says. A gallery with no
 * published photographs is a real state; a query that did not answer is not
 * that state.
 *
 * Wrapped in `cache` because every page that has metadata asks twice.
 *
 * Next dedupes `fetch` across `generateMetadata` and the page body; this is
 * a Neon query, so nothing deduped it. `/photo/[id]` reads the entire
 * published feed — every row, every base64 blur placeholder — once to build
 * the share card and again to render, so a crawl of N photographs cost 2N
 * full-feed queries. `React.cache` is the documented answer when `fetch` is
 * not involved, and it dedupes per request, which is exactly the scope of
 * the duplication.
 */
export const listGalleryImages = cache(
  async (authorSlug?: string): Promise<GalleryImage[]> => {
    const rows = await listPublishedPhotos(authorSlug);
    return rows.map(toGalleryImage);
  },
);
