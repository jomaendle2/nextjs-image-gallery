import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site-url";

/**
 * Open to crawlers, with the contributor's workspace kept out.
 *
 * `/api/` is disallowed rather than merely uninteresting: `/api/og` renders
 * an image per unique `title` query, so a crawler walking arbitrary query
 * strings would have us generating images for it indefinitely.
 *
 * **`/api/og` is allowed back, and the sentence that used to be here was
 * wrong.** It claimed the share cards "are still reached through each page's
 * meta tags, which `Disallow` does not affect" — but Facebook, X, LinkedIn
 * and Slack all read `robots.txt` before fetching an `og:image`, so the
 * disallow silently broke every share preview on the site. A card nobody can
 * fetch is a card that was never built.
 *
 * The walking concern is real and is answered where it arises rather than
 * here: the route truncates every text input, renders at most three
 * photographs, now accepts image URLs only from our own Blob store, and is
 * cached for a day with a week of stale-while-revalidate.
 *
 * `Allow` is listed before the `Disallow` it carves out of, which is how the
 * more specific rule wins for the crawlers that go by order rather than by
 * path length.
 */
export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/og"],
        disallow: [
          "/api/",
          "/contribute/admin",
          "/contribute/photos",
          "/contribute/verify",
        ],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
