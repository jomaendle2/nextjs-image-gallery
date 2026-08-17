import type { GalleryImage } from "@/data/galleryData";
import { photoAltText } from "@/lib/photos/alt-text";

/**
 * The gallery as something you can subscribe to.
 *
 * Until this existed there was no way to follow the site at all: every
 * visitor was a one-time arrival from a link, and a photographer's argument
 * for publishing here stopped at "it will be on a page". A feed is the
 * cheapest possible answer to both, and it costs the reader nothing and
 * gives us nothing to store about them.
 */

/** Feeds are a recent-items format. Older work is what the sitemap is for. */
export const FEED_LIMIT = 50;

/**
 * The XML, wrapped as the response both feed routes return identically.
 *
 * They had each written out the same content type and the same cache header
 * by hand, with the reasoning commented on one of them and silently copied
 * to the other — so a reader of `/by/[slug]/feed.xml` met three magic numbers
 * with nothing explaining them, and any change to the caching would have had
 * to be made twice to stay true.
 *
 * A reader polls a feed on its own schedule and there is no reason for every
 * one of them to reach the database. An hour at the edge with a day of
 * stale-while-revalidate means a burst of subscribers costs one query, and a
 * slow rebuild never leaves anybody with nothing.
 */
export function rssResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control":
        "public, s-maxage=3600, stale-while-revalidate=86400, max-age=0",
    },
  });
}

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

const XML_SPECIAL = /[&<>"']/g;

/**
 * Escapes a value for XML text or an attribute.
 *
 * `&` has to be replaced first or it would double-escape the entities the
 * later replacements introduce, which is why this is one pass over a
 * character class rather than a chain of `.replace` calls. Photographs carry
 * titles and descriptions written by contributors, so every one of these is
 * untrusted text going into a document a stranger's reader will parse.
 */
export function escapeXml(value: string): string {
  return value.replace(XML_SPECIAL, (char) => XML_ESCAPES[char] ?? char);
}

function itemOf(image: GalleryImage, origin: string): string {
  const url = `${origin}/photo/${image.id}`;
  const title =
    image.title === ""
      ? `A photograph by ${image.author.name}`
      : `${image.title} — ${image.author.name}`;

  /*
   * `enclosure` is what makes a reader show the photograph rather than a
   * line of text, and it is the whole point of a feed for a gallery. The
   * length attribute is required by the spec and unknown to us without
   * fetching the file, which is not worth a round trip per item per rebuild;
   * readers treat 0 as "unstated" rather than "empty".
   */
  return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${new Date(image.publishedAt).toUTCString()}</pubDate>
      <dc:creator>${escapeXml(image.author.name)}</dc:creator>
      <description>${escapeXml(photoAltText(image))}</description>
      <enclosure url="${escapeXml(image.src.src)}" type="image/jpeg" length="0" />
    </item>`;
}

interface FeedMeta {
  title: string;
  description: string;
  /** Absolute, no trailing slash. */
  origin: string;
  /** Where this document lives, so `atom:link rel="self"` can be honest. */
  selfPath: string;
}

export function buildRssFeed(
  images: readonly GalleryImage[],
  meta: FeedMeta,
): string {
  /*
   * Sorted here rather than taken in gallery order, which is the one thing
   * about this that had to be found by looking at real output.
   *
   * The feed query orders by `is_opener DESC, published_at DESC`, so the
   * pinned opening photograph comes first no matter when it was published —
   * correct for a gallery, wrong for a subscription. A reader shows items in
   * the order given and dates them by `pubDate`, so a pinned five-month-old
   * photograph would sit above this morning's work in every subscriber's
   * list, permanently. The pin is a decision about how the site opens, not
   * about what is new.
   */
  const items = [...images]
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    )
    .slice(0, FEED_LIMIT);

  /*
   * The newest item's date, not the build time. A feed whose
   * `lastBuildDate` moves on every revalidation tells every reader it has
   * changed when it has not.
   */
  const latest = items[0]?.publishedAt;

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(meta.title)}</title>
    <link>${escapeXml(meta.origin)}</link>
    <description>${escapeXml(meta.description)}</description>
    <language>en</language>
    <atom:link href="${escapeXml(meta.origin + meta.selfPath)}" rel="self" type="application/rss+xml" />${
      latest === undefined
        ? ""
        : `\n    <lastBuildDate>${new Date(latest).toUTCString()}</lastBuildDate>`
    }
${items.map((image) => itemOf(image, meta.origin)).join("\n")}
  </channel>
</rss>
`;
}
