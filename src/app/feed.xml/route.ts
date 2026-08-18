import { listGalleryImages } from "@/data/galleryData";
import { buildRssFeed, rssResponse } from "@/lib/feed";
import { SITE_DESCRIPTION } from "@/lib/metadata";
import { siteOrigin } from "@/lib/site-url";

/** Matches the pages it describes. */
export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const images = await listGalleryImages();

  const xml = buildRssFeed(images, {
    title: "the beauty of earth.",
    description: SITE_DESCRIPTION,
    origin: siteOrigin(),
    selfPath: "/feed.xml",
  });

  return rssResponse(xml);
}
