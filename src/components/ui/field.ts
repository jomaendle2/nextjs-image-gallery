/**
 * Shared form field styling.
 *
 * The same class string had been copied into three forms, which is how they
 * drifted to 38px tall — under the 44px minimum a finger needs, and awkward
 * to fix in three places. `min-h-11` is the floor; everything else is the
 * look, defined once.
 *
 * The surface is `glass-hairline` rather than a hand-rolled fill and border:
 * flat on purpose, since a form field is printed on the page rather than
 * floating over a photograph, and blurring one per input would be expensive
 * for an effect nobody would see behind an opaque form.
 */

export const FIELD =
  "glass-hairline min-h-11 w-full rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-white transition-colors placeholder:text-white/30 hover:border-white/25 focus-visible:border-white/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80";

export const LABEL = "block font-medium text-sm text-white/70";

/** For the optional-field hint that follows a label. */
export const LABEL_HINT = "text-white/35";

/**
 * A standalone text link that still clears the 44px touch floor.
 *
 * The padding is pulled straight back out by the negative margin, so the link
 * grows a finger-sized target without moving the text it sits beside. Links
 * inside a sentence are exempt from the rule and do not need this.
 */
export const TOUCH_LINK = "-my-3 inline-flex min-h-11 items-center py-3";
