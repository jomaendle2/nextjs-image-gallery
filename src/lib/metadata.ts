import type { Metadata } from "next";

/**
 * The `alternates` block for a page, with the feed link kept attached.
 *
 * Next merges metadata from the root layout down, but a top-level field is
 * replaced rather than merged — so `alternates` is all-or-nothing. That
 * caught this site twice, in opposite directions:
 *
 * Pages that set no `alternates` inherited the root's `canonical: "/"`.
 * `/photographers` and `/contribute/apply` are both in the sitemap, both
 * indexable, and both were telling Google they were duplicates of the home
 * page — the recruitment hub and its conversion page, dropped from the index
 * by their own metadata.
 *
 * Pages that did set a canonical replaced the whole block and lost the RSS
 * autodiscovery link with it, including `/photo/[id]` — the URL people
 * actually land on from a shared link, and so the likeliest place somebody
 * would try to subscribe from.
 *
 * One helper, so a page states its canonical and cannot drop the feed by
 * doing so. The root layout no longer sets a canonical at all: an inherited
 * one is wrong on every page that forgets to override it, which is a trap
 * that springs on whoever adds the next page rather than on whoever set it.
 */
const FEED: NonNullable<NonNullable<Metadata["alternates"]>["types"]> = {
  "application/rss+xml": [{ url: "/feed.xml", title: "the beauty of earth." }],
};

export function alternates(canonical: string): Metadata["alternates"] {
  return { canonical, types: FEED };
}

/**
 * As above, for a photographer's page, which has a feed of its own worth
 * offering alongside the site-wide one.
 */
export function contributorAlternates(
  canonical: string,
  slug: string,
  name: string,
): Metadata["alternates"] {
  return {
    canonical,
    types: {
      "application/rss+xml": [
        {
          url: `/by/${slug}/feed.xml`,
          title: `${name} — the beauty of earth.`,
        },
        ...(FEED["application/rss+xml"] as { url: string; title: string }[]),
      ],
    },
  };
}
