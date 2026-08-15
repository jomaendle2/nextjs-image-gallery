/**
 * Shared form field styling.
 *
 * The same class string had been copied into three forms, which is how they
 * drifted to 38px tall — under the 44px minimum a finger needs, and awkward
 * to fix in three places. `min-h-11` is the floor; everything else is the
 * look, defined once.
 */

export const FIELD =
  "min-h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white transition-colors placeholder:text-white/30 hover:border-white/25 focus-visible:border-white/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80";

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
