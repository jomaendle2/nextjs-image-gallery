/**
 * What to call a photograph that has not been called anything.
 *
 * A title is empty for the whole of a photograph's life as a draft, and stays
 * empty if the photographer never fills it in — so every surface that lists
 * photographs needs a word for that, and six of them had reached for one
 * independently. Four spellings: `title === ""`, `(title ?? "").trim() === ""`
 * twice inside one expression, and the same ternary written out twice in two
 * separate `.map()`s over the same array.
 *
 * They agreed today, which is exactly why this is worth doing now: they
 * agreed by coincidence, and the one that used `=== ""` without a trim would
 * have printed a title of a single space as though it were a name.
 *
 * `fallback` is a parameter because the admin list says "Untitled draft"
 * rather than "Untitled" — it is looking at everybody's work including
 * unpublished rows, where "draft" is the useful half of the sentence.
 */
export function photoTitle(
  title: string | null | undefined,
  fallback = "Untitled",
): string {
  const value = title ?? "";
  return value.trim() === "" ? fallback : value;
}
