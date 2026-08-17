/**
 * Form and link styling, defined once.
 *
 * Each of these was a class string copied between files before it was a
 * constant, and each copy had drifted by the time it was pulled out — which
 * is the whole reason they are constants rather than inline.
 */

/**
 * A text input or textarea.
 *
 * `min-h-11` is the 44px touch floor. `glass-hairline` rather than a blurred
 * surface: a field is printed on the page rather than floating over a
 * photograph, and blurring one per input costs a full backdrop snapshot for
 * an effect nobody sees behind an opaque form.
 */
export const FIELD =
  "glass-hairline min-h-11 w-full rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-white transition-colors placeholder:text-white/50 hover:border-white/25 focus-visible:border-white/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80";

export const LABEL = "block font-medium text-sm text-white/70";

/** The "(optional)" that follows a label. */
export const LABEL_HINT = "text-white/55";

/**
 * A standalone link that clears the 44px floor.
 *
 * The padding is pulled straight back out by the negative margin, so the
 * target grows without moving the text beside it. Links inside a sentence are
 * exempt from the rule and must not use this.
 */
export const TOUCH_LINK = "-my-3 inline-flex min-h-11 items-center py-3";

/**
 * A link inside a sentence, on a reading page.
 *
 * Accent rather than white: on these pages a link is the only thing that does
 * something. Links in the viewer stay white — there the photograph is the
 * subject and nothing else may compete.
 */
export const LINK =
  "text-accent underline underline-offset-4 transition-colors hover:text-accent-bright focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent";

/**
 * The small-caps metadata treatment — photo counts, section labels, the
 * exposure line. The single most repeated class run on the site.
 */
export const META =
  "text-[0.6875rem] text-white/55 uppercase tracking-[0.14em]";

/**
 * A section heading on a reading page.
 *
 * `META` had been standing in for this everywhere, which is how `/membership`
 * ended up with an `h1` and then three sections all set at 11px uppercase:
 * every heading below the title was the same size as the exposure line, so
 * the page had a title and then a flat wall. `META` is a label — a caption
 * for a number or a field — and a heading that introduces several paragraphs
 * is not a label.
 *
 * One step, deliberately. Four `h2` scales had accumulated across the reading
 * pages; a scale with more rungs than the pages need is how that happens.
 */
export const SECTION_HEADING =
  "font-semibold text-white text-lg tracking-[-0.03em] sm:text-xl";
