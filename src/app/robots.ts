import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site-url";

/**
 * Open to crawlers, with the contributor's workspace kept out.
 *
 * `/api/` is disallowed rather than merely uninteresting: `/api/og` renders
 * an image per unique `title` query, so a crawler walking arbitrary query
 * strings would have us generating images for it indefinitely. The OG
 * images that matter are still reached through each page's meta tags, which
 * `Disallow` does not affect.
 */
export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
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
