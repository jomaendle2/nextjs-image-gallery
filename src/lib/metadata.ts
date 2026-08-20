import type { Metadata } from "next";
import { isOurBlob } from "./blob-host";

/**
 * The one sentence that describes this site to anybody who has not opened it.
 *
 * It is the `<meta name="description">`, the `og:description`, the
 * `twitter:description`, the web manifest's `description` and the feed's —
 * five surfaces, none of which a visitor sees, and every one of which is
 * read by a machine that will repeat it to somebody.
 *
 * It was written three times and the layout's copy had drifted furthest:
 * "Images from around the world. Explore the beauty of our planet 🌍" was the
 * only place on the site that said "images" rather than "photographs", the
 * only imperative, and the only emoji — so the site's single piece of
 * marketing copy was also the only sentence not in its voice. The manifest's
 * was already right, and says something true that the other did not: the
 * photographs come from invited people, which is the whole proposition.
 *
 * It said "a small group of" until the homepage was promising a group that
 * `/photographers` disproved in two taps, with one name on it. Deleting the
 * word is the fix, not a count: this string is a manifest field, a feed field
 * and an OG tag as well as a sentence, and a number in it would be a
 * cache-invalidation problem across all six surfaces for the benefit of the
 * one that a human reads. What remains is true at one photographer and at
 * ten, so it never has to be revisited — and *invited*, the proposition the
 * sentence exists to state, survives.
 *
 * Here rather than in any of the five, because a sentence typed in five
 * places is a sentence with five versions eventually — the same reason
 * `--color-surface` and the manifest's colours became one value each.
 */
export const SITE_DESCRIPTION =
  "Photographs from around the world, by invited photographers.";

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

/**
 * The share card for a page, as a URL into `/api/og`.
 *
 * Written out by hand in three places, each escaping its own parameters, and
 * one of them differed: the site-wide card passes a title only, the
 * slideshow's adds a subtitle, the photographer's adds both plus a strip of
 * photographs. Nothing was wrong with any of them, which is precisely how a
 * fourth ends up subtly different from the other three — a missing
 * `encodeURIComponent` around a name with an ampersand in it truncates the
 * card's title and nobody sees it, because nobody looks at their own link
 * previews.
 *
 * `previews` are absolute blob URLs, joined with commas because that is the
 * shape the route already parses. An empty list omits the parameter rather
 * than sending an empty one: the route treats "no previews" and "a preview
 * that failed to load" differently, and only the first of those is true here.
 *
 * A relative URL, resolved against `metadataBase` by Next. Absolute would
 * mean reading the origin, and the origin is configuration this module has no
 * business knowing about.
 */
export function ogCard(options: {
  title: string;
  subtitle?: string;
  previews?: readonly string[];
}): string {
  const query = new URLSearchParams({ title: options.title });

  if (options.subtitle !== undefined && options.subtitle !== "") {
    query.set("subtitle", options.subtitle);
  }

  /*
   * Only what a share card can actually fetch, decided by the same predicate
   * the route decides with. This filter used to be `startsWith("https://")`
   * under a comment claiming the route "refuses anything that is not one of
   * our blobs" — which is true of the route and was not true here, so a URL
   * on somebody else's host passed this and was dropped by `isOurBlob` at the
   * other end: the silently-empty strip the comment exists to prevent,
   * arranged by the check meant to prevent it.
   *
   * `blob-host.ts` is safe to import from a module that reaches the client
   * bundle: it has no imports, reads no environment and touches no node API.
   * It is also the fourth place that would otherwise re-derive a rule whose
   * own header asks for "one definition, imported by both".
   */
  const usable = (options.previews ?? []).filter(isOurBlob);
  if (usable.length > 0) {
    query.set("previews", usable.join(","));
  }

  return `/api/og?${query}`;
}

/**
 * The whole `openGraph`/`twitter` pair for a page, card included.
 *
 * `ogCard` consolidated the URL; this consolidates what is built around it,
 * which had gone wrong in the way the docblock above predicted one level up.
 * Five hand-written blocks existed and no two agreed: two set `og.url` and
 * three did not, one set `og.type`, one mirrored the title and description
 * into `twitter`, and exactly one carried image `alt` text — the root
 * layout, which spends eight comment lines on why alt text on a share card
 * matters. The two newest blocks were copied from the thinnest of the three.
 *
 * So this emits the *union* of what the five set rather than their
 * intersection: every page now gets `og:type`, an `og:url`, image dimensions,
 * alt text, and a `twitter` block that says who it is. `alt` is a required
 * parameter, which is the point — it stops being forgettable by being typed.
 *
 * `title` is a parameter rather than read from the page's `title`, because
 * they genuinely differ: `/by/[slug]` puts the bare display name on the card
 * and the suffixed one in the tab.
 *
 * `url` is relative, resolved against `metadataBase` for the reason `ogCard`
 * gives about origins.
 */
export function shareCard(options: {
  title: string;
  description: string;
  url: string;
  card: string;
  alt: string;
}): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: {
      type: "website",
      title: options.title,
      description: options.description,
      url: options.url,
      images: [
        { url: options.card, width: 1200, height: 630, alt: options.alt },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: options.title,
      description: options.description,
      images: [options.card],
    },
  };
}
