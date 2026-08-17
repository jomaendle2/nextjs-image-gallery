import type { MetadataRoute } from "next";
import { listGalleryImages } from "@/data/galleryData";
import { listPublicContributorSlugs } from "@/lib/auth/contributors";
import { siteOrigin } from "@/lib/site-url";

/**
 * Re-generated hourly, matching the `revalidate` on the pages it lists.
 * A sitemap that is staler than the pages it describes is worse than none:
 * it teaches the crawler to distrust the `lastModified` dates.
 */
export const revalidate = 3600;

/**
 * Every page worth crawling, which is not every page that exists.
 *
 * The contribute flow is deliberately absent apart from its two public
 * doors (`/contribute` and `/contribute/apply`). `/contribute/photos`,
 * `/contribute/admin` and `/contribute/verify` are all behind a session or
 * carry a single-use token, so listing them would only ever hand a crawler
 * a redirect to chew on — and `robots.ts` disallows them outright.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: origin, changeFrequency: "daily", priority: 1 },
    {
      url: `${origin}/photographers`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${origin}/subscribe`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    { url: `${origin}/contribute`, changeFrequency: "monthly", priority: 0.7 },
    {
      url: `${origin}/contribute/apply`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    { url: `${origin}/membership`, changeFrequency: "monthly", priority: 0.8 },
    /*
     * Worth crawling on its own: it is the gallery organised by geography,
     * and every photograph with a marked place is reachable from it as a
     * plain link with no JavaScript involved.
     */
    { url: `${origin}/globe`, changeFrequency: "weekly", priority: 0.8 },
    /*
     * Low priority but present. Nobody searches for these, and they should
     * not compete with a photograph — but a legal notice that crawlers
     * cannot see is one a reader may not be able to find either, and being
     * findable is the whole requirement.
     */
    ...["imprint", "privacy", "terms"].map((page) => ({
      url: `${origin}/${page}`,
      changeFrequency: "yearly" as const,
      priority: 0.2,
    })),
  ];

  /*
   * Both lists at once. They are independent queries against the same
   * database and neither reads the other, so awaiting them in turn spent one
   * full round trip doing nothing — on the one route that has to finish
   * before a crawler will look at any of the pages it names.
   *
   * A revoked contributor's page 404s, so listing it would be a crawl error
   * we reported ourselves, and somebody who has uploaded but published
   * nothing gets an empty gallery. `listPublicContributorSlugs` is that
   * filter, shared with the two `/by` routes so the set advertised here and
   * the set prerendered there cannot drift apart.
   */
  const [slugs, images] = await Promise.all([
    listPublicContributorSlugs(),
    listGalleryImages(),
  ]);

  const contributorRoutes: MetadataRoute.Sitemap = slugs.flatMap((slug) => [
    {
      url: `${origin}/by/${slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    },
    {
      url: `${origin}/by/${slug}/slideshow`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    },
  ]);

  /*
   * One entry per photograph. These are the pages with something unique to
   * say — a title, a description, and an image of their own — so they are
   * the ones most worth crawling, and there are far more of them than there
   * are of everything else here put together.
   */
  const photoRoutes: MetadataRoute.Sitemap = images.map((image) => ({
    url: `${origin}/photo/${image.id}`,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  return [...staticRoutes, ...contributorRoutes, ...photoRoutes];
}
