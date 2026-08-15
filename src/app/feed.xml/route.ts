import { getGalleryImages } from "@/data/galleryData";
import { buildRssFeed } from "@/lib/feed";
import { siteOrigin } from "@/lib/site-url";

/** Matches the pages it describes. */
export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const images = await getGalleryImages();

  const xml = buildRssFeed(images, {
    title: "the beauty of earth.",
    description:
      "Photographs from around the world, by a small group of invited photographers.",
    origin: siteOrigin(),
    selfPath: "/feed.xml",
  });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      /*
       * A reader polls this on its own schedule and there is no reason for
       * every one of them to reach the database. An hour at the edge with a
       * day of stale-while-revalidate means a burst of subscribers costs one
       * query, and a slow rebuild never leaves anybody with nothing.
       */
      "Cache-Control":
        "public, s-maxage=3600, stale-while-revalidate=86400, max-age=0",
    },
  });
}
