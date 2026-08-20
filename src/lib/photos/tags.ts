/**
 * The subjects a photograph can be filed under.
 *
 * A closed list, and that is the whole design. Free text would have been one
 * line of schema and would have made the feature worthless for the thing it
 * exists for: a model asked to describe this gallery's photographs in its own
 * words returns "coast" and "coastline" and "coastal" and "shoreline" for
 * four pictures of the same thing, and a browse page built on that shows four
 * entries of one photograph each. The value of a tag is entirely in two
 * photographs sharing it.
 *
 * So the model does not invent tags, it *picks* them — `suggest.ts` hands
 * this list to the schema as an enum, which means the provider cannot return
 * anything outside it and the server does not have to guess whether an
 * unfamiliar word is a typo or a new subject. The slug is the identity: these
 * strings are what would end up in `/tag/<slug>` and what a future filter
 * would group by, so they are lowercase, hyphen-free and chosen to read
 * plainly in a URL.
 *
 * Adding one is a deliberate act with a cost: the tag is only useful once
 * several photographs carry it, and every entry that never gets picked is a
 * chip in the way of the ones that do. `docs/next-version.md` records the
 * browse pages this is groundwork for, and the trigger for building them.
 */

/**
 * Chosen against the gallery that exists rather than a taxonomy of nature.
 *
 * Every entry here would land on at least one of the photographs already
 * published, and most on several — the coasts of Portugal and California, the
 * volcanoes of Java and Peru, the ice of Patagonia, the palms of Thailand and
 * Bali. A vocabulary that covers subjects nobody here photographs is a
 * vocabulary of empty pages.
 */
export const PHOTO_TAGS = [
  "coast",
  "beach",
  "cliffs",
  "ocean",
  "waves",
  "mountains",
  "volcano",
  "glacier",
  "ice",
  "snow",
  "desert",
  "canyon",
  "forest",
  "jungle",
  "palms",
  "blossom",
  "flowers",
  "wildlife",
  "city",
  "architecture",
  "ruins",
  "road",
  "lake",
  "river",
  "waterfall",
  "sunrise",
  "sunset",
  "night",
  "clouds",
  "fog",
] as const;

export type PhotoTag = (typeof PHOTO_TAGS)[number];

/**
 * How many tags a photograph may carry.
 *
 * Five, because a photograph that is about eight things is about nothing, and
 * because the point of a tag is to be a shared axis rather than a description
 * — the description field is right there and says it better. The model is
 * asked for at most this many too, so the chips it offers are already a
 * shortlist rather than a menu to prune.
 */
export const MAX_PHOTO_TAGS = 5;

const LOOKUP = new Set<string>(PHOTO_TAGS);

/** Whether a string is one of the tags, narrowing it when it is. */
export function isPhotoTag(value: unknown): value is PhotoTag {
  return typeof value === "string" && LOOKUP.has(value);
}

/**
 * The tags in a list of strings, deduplicated, capped, and in list order.
 *
 * Ordered by `PHOTO_TAGS` rather than by arrival, so the same set of tags
 * always renders in the same sequence — a row of chips that reshuffles
 * between two photographs carrying the same subjects reads as instability.
 * Anything unrecognised is dropped in silence: it can only reach here from a
 * hand-built request, since the model picks from an enum and the form posts
 * what it was given.
 */
export function readPhotoTags(values: readonly unknown[]): PhotoTag[] {
  const chosen = new Set(values.filter(isPhotoTag));
  return PHOTO_TAGS.filter((tag) => chosen.has(tag)).slice(0, MAX_PHOTO_TAGS);
}
