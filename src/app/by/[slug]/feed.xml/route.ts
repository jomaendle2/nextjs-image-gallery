import { notFound } from "next/navigation";
import { listGalleryImages } from "@/data/galleryData";
import { getContributorBySlug } from "@/lib/auth/contributors";
import { buildRssFeed, rssResponse } from "@/lib/feed";
import { siteOrigin } from "@/lib/site-url";

export const revalidate = 3600;

/**
 * One photographer's work, as a subscription.
 *
 * The whole-gallery feed answers "show me new photographs"; this answers
 * "show me new photographs *by her*", which is the more useful question for
 * anyone who arrived through a particular photographer — and it is the
 * concrete version of what this site offers a contributor. "People can
 * subscribe to you" is a better sentence than "your work appears in a
 * gallery", and it costs a route.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;

  /*
   * Both queries at once. The photographs are keyed by slug, so the feed's
   * items never depended on the contributor row — the two were sequential
   * only because they were written in that order.
   *
   * A slug nobody owns costs one wasted query, since the photographs are
   * fetched before `notFound()` can fire. A feed reader polls this on a
   * timer, so the round trip saved on every real request is worth more than
   * the one spent on a request that was going to 404 anyway.
   */
  const [contributor, images] = await Promise.all([
    getContributorBySlug(slug),
    listGalleryImages(slug),
  ]);
  if (!contributor) {
    notFound();
  }

  const xml = buildRssFeed(images, {
    title: `${contributor.display_name} — the beauty of earth.`,
    description: `Photographs by ${contributor.display_name}.`,
    origin: siteOrigin(),
    selfPath: `/by/${contributor.slug}/feed.xml`,
  });

  return rssResponse(xml);
}
