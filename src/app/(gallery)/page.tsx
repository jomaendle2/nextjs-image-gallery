import type { Metadata } from "next";
import { EmptyGallery } from "@/components/gallery/EmptyGallery";
import { ImageCarousel } from "@/components/gallery/ImageCarousel";
import { StructuredData } from "@/components/StructuredData";
import { listGalleryImages } from "@/data/galleryData";
import { membershipConfigured } from "@/lib/members/offer";
import { alternates } from "@/lib/metadata";
import { siteOrigin } from "@/lib/site-url";
import { gallerySchema } from "@/lib/structured-data";

/**
 * The canonical and the feed link, which every other page already declares.
 *
 * The root layout deliberately stopped setting a default `alternates` on the
 * reasoning that each page states its own — and twelve of them do. This one
 * was missed, which left the highest-priority URL in the sitemap as the only
 * indexable page with no canonical: every `?utm_*` variant, trailing slash
 * and preview domain was a free duplicate of the front door.
 */
export const metadata: Metadata = {
  alternates: alternates("/"),
};

/**
 * Statically rendered and refreshed daily. Publishing calls
 * `revalidatePath("/")`, so the day is only a backstop — visitors see new
 * work immediately, and an anonymous visit never touches a session or waits
 * on a query.
 *
 * It was an hour, and the hour was what exhausted Neon's free compute. Every
 * public route shares this window, and a crawler walking the sitemap
 * re-renders whichever entries have lapsed, so an hourly backstop across a
 * few hundred URLs became a query every few seconds. Neon only suspends after
 * five idle minutes, so the database never slept. Every write a visitor can
 * see already clears its pages through `revalidateFeeds`; the window only
 * has to catch what a script changes. `src/lib/cache-window.test.ts` keeps
 * every route on the same one.
 */
export const revalidate = 86_400;

export default async function Home() {
  /*
   * The throwing variant, deliberately — "empty because there is nothing" and
   * "empty because the query did not answer" are different states, and this
   * page used to render both as `EmptyGallery`.
   *
   * Under the `revalidate` above that was the worst possible reading of a
   * transient failure: rendering the empty state *succeeds*, so Next cached
   * the blank front page and served it to everyone for the rest of the hour.
   * Letting the error through means the last good page keeps being served
   * during revalidation and the next request retries. See `galleryData.ts`.
   */
  const images = await listGalleryImages();

  if (images.length === 0) {
    return <EmptyGallery />;
  }

  return (
    <>
      <StructuredData
        data={gallerySchema(images, siteOrigin(), "the beauty of earth.")}
      />
      <ImageCarousel
        images={images}
        membershipOffered={membershipConfigured()}
      />
    </>
  );
}
