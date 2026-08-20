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
  "glass-hairline min-h-11 w-full rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-white transition-colors placeholder:text-white/55 hover:border-white/25 focus-visible:border-white/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80";

export const LABEL = "block font-medium text-sm text-white/70";

/** The "(optional)" that follows a label. */
export const LABEL_HINT = "text-white/55";

/**
 * A standalone link that clears the 44px floor, in both directions.
 *
 * The padding is pulled straight back out by the negative margin, so the
 * target grows without moving the text beside it. Links inside a sentence are
 * exempt from the rule and must not use this.
 *
 * `min-w-11` and the horizontal pair are the half this was missing, and it is
 * the mistake DESIGN.md records by name: "once by giving a link `min-h-11`
 * and leaving it 13px wide". It had happened again — the footer's own comment
 * believed the copyright link was the last offender, while `Globe` measured
 * 33px wide, `Terms` 35 and `Imprint` 40. A 44px floor on one axis is not a
 * 44px target.
 *
 * No `justify-center`: `min-w-11` pads a short link out to the floor, and
 * centring inside that box would ragged the left edge of any left-aligned
 * list containing a title shorter than 44px. The padding goes on the end.
 */
export const TOUCH_LINK =
  "-mx-2 -my-3 inline-flex min-h-11 min-w-11 items-center px-2 py-3";

/**
 * The bordered card the contributor workspace states things in.
 *
 * `FirstRun` and `JustLive` are the two of these, and they are the two ends of
 * the same screen: one greets somebody who has published nothing, the other
 * marks the moment they have published their first. They are never on the
 * page together, which is exactly how the pair would drift — nobody sees the
 * two borders side by side to notice one is a different radius.
 *
 * Here for the reason at the top of this file rather than because two is a
 * crowd: the shell was copied the moment the second card existed.
 */
export const WORKSPACE_CARD = "mb-8 rounded-3xl border border-white/[0.08] p-6";

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
 * The small-caps metadata treatment, without its colour.
 *
 * Exists for the one control that has to set its own: `ShareButton` is handed
 * a `text-white/…` by each call site, so giving it the coloured `META` would
 * put two `text-white/*` utilities in one class attribute and leave which one
 * wins to Tailwind's emit order rather than to the call site. Everything else
 * wants `META`, and reaching for this instead is almost always a mistake.
 */
export const META_TYPE = "text-[0.6875rem] uppercase tracking-[0.14em]";

/**
 * The small-caps metadata treatment — photo counts, section labels, the
 * exposure line. The single most repeated class run on the site.
 *
 * Repeated often enough that it had been re-typed rather than imported twice:
 * the gallery's one top-bar link spelled the whole run out and imported
 * nothing from this file, and the share button spelled out its size and
 * tracking. `design.test.ts` now forbids the run anywhere but here, because a
 * constant nobody is obliged to use is a suggestion.
 */
export const META = `${META_TYPE} text-white/55`;

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

/**
 * The heading on one item in a list or a grid of them.
 *
 * A third rung below `SECTION_HEADING`, and it earns the place the same way
 * `PAGE_TITLE` did: two files had independently arrived at byte-identical
 * `font-semibold text-[0.9375rem] text-white tracking-[-0.02em]` — the offer
 * cards on `/contribute/apply` and the member-benefit rows on `/membership`.
 * Agreement between two sites that never imported from each other is a
 * measurement, not a coincidence.
 *
 * Distinct from `SECTION_HEADING` on purpose. That one introduces several
 * paragraphs and is `text-lg sm:text-xl`; this one names a card inside a grid
 * of six, where that size would out-shout the section heading above it. Three
 * rungs is the whole scale, and a fourth needs the same kind of evidence
 * this one has.
 */
export const ITEM_HEADING =
  "font-semibold text-[0.9375rem] text-white tracking-[-0.02em]";

/**
 * The `h1` at the top of a page that is read rather than looked through.
 *
 * The tracking is a vote rather than a taste. Five pages set this heading by
 * hand and four of them agreed on `-0.035em` — `/globe`, `/photographers`,
 * the photographer pages and every status page. The fifth, `ContributeShell`,
 * sat at `-0.04em`, and because it is the frame for `/contribute/*`,
 * `/membership`, `/subscribe` and all three legal notices, the minority
 * spelling was on the larger number of routes. That is exactly the argument
 * not to have: four independent decisions agreeing is a measurement, one
 * component's default is a default. Four against one decides it, and now
 * nobody decides it again.
 *
 * No colour. The reading pages inherit white from their shell and the
 * photographer header sets its own, and a token that carries a colour into
 * `src/components/gallery` is the shape of the mistake `design.test.ts`
 * rule 4 exists to catch.
 */
export const PAGE_TITLE =
  "font-semibold text-2xl tracking-[-0.035em] sm:text-3xl";

/**
 * A paragraph of prose on a reading page.
 *
 * Body text had five sizes and four opacities across the site — `text-sm`,
 * `text-[0.8125rem]`, `text-[0.9375rem]`, `text-base` and `text-[1.0625rem]`,
 * at `/50`, `/55`, `/60` and `/65` — with no rule anywhere for which meant
 * what. Two rungs is what the pages actually need: this one for the prose a
 * reader came to read, and `BODY_SMALL` for the note beside it.
 */
export const BODY = "text-[0.9375rem] text-white/65 leading-relaxed";

/**
 * The subordinate line: a caption, a caveat, the detail under a heading.
 *
 * `/55`, not `/50`, and that closes a live contradiction rather than settling
 * a preference. `design.test.ts`'s `TOO_FAINT` used to flag only 10–45 while
 * the failure message beside it asked for "text-white/55 or higher" — so
 * everything from 46 to 54 passed a test that told them in words they were
 * wrong, and five sites had settled in that gap. `/55` is the measured AA
 * figure (≈5.3:1 on `--ground`).
 *
 * The regex has since been tightened to match the message, so the gap is
 * closed in both directions rather than only in this constant. That order
 * matters: fixing the sites without fixing the rule leaves the next one free
 * to reappear.
 */
export const BODY_SMALL = "text-[0.8125rem] text-white/55 leading-relaxed";

/**
 * One destination in a section nav, and how the current one is marked.
 *
 * Hoisted out of `SiteNav` and `WorkspaceNav`, which had byte-identical
 * copies of the two state strings. The duplication was not merely repetition:
 * `NAV_CURRENT`'s underline insets are numerically coupled to `NAV_LINK`'s
 * padding, so changing the padding in one file left the rule misaligned in
 * the other — and only in one of the two zones, which is the hardest kind of
 * drift to notice. `ViewToggle` had already grown a third, drifted spelling.
 *
 * The two navs keep their own destination lists and their own `<nav>`
 * wrappers, because what differs between them is *which* places exist and who
 * they are for. How a current section is drawn is one design decision and
 * belongs in one place, which is here beside the other tokens.
 *
 * The mark is a rule under the word rather than colour alone: `aria-current`
 * answers this for a screen reader and full-strength white answers it for
 * anyone comparing the items side by side, but neither survives being glanced
 * at by somebody who has never seen the other state.
 */
export const NAV_LINK = `${META_TYPE} relative inline-flex min-h-11 items-center rounded-full px-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 sm:px-3`;

export const NAV_CURRENT =
  "text-white after:absolute after:inset-x-2 after:bottom-1.5 after:h-px after:bg-white/45 sm:after:inset-x-3";

export const NAV_IDLE = "text-white/55 hover:text-white";

/** The current-or-not pair, so no caller re-types the ternary. */
export function navLink(current: boolean, extra = ""): string {
  return `${NAV_LINK} ${current ? NAV_CURRENT : NAV_IDLE} ${extra}`.trim();
}
