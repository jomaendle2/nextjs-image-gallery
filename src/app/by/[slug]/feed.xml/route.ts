import { notFound } from "next/navigation";
import { listGalleryImages } from "@/data/galleryData";
import { getContributorBySlug } from "@/lib/auth/contributors";
import { buildRssFeed } from "@/lib/feed";
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
  const contributor = await getContributorBySlug(slug);
  if (!contributor) {
    notFound();
  }

  const images = await listGalleryImages(slug);

  const xml = buildRssFeed(images, {
    title: `${contributor.display_name} — the beauty of earth.`,
    description: `Photographs by ${contributor.display_name}.`,
    origin: siteOrigin(),
    selfPath: `/by/${contributor.slug}/feed.xml`,
  });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control":
        "public, s-maxage=3600, stale-while-revalidate=86400, max-age=0",
    },
  });
}
