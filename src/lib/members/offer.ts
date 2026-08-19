import process from "node:process";

/**
 * Whether membership is on sale at all, for hiding the UI when it is not.
 *
 * Two environment variables and a `Boolean` — no Stripe object is
 * constructed, no network call is made, and nothing here needs a key to be
 * valid, only present.
 *
 * It lives in a file of its own rather than in `stripe.ts`, and the reason is
 * the second line of that file: `import Stripe from "stripe"`. The SDK is
 * around nineteen megabytes on disk, and Next traces imports to decide what
 * to deploy alongside a route — so `SiteFooter`, which renders on every page
 * that scrolls, was shipping the whole Stripe client to answer a question
 * about two strings. The membership page did the same.
 *
 * Anything else that wants to know whether payments exist belongs here too.
 * The rule is the one that made this file necessary: a module that merely
 * asks about Stripe must not have to load it.
 */
export function membershipConfigured(): boolean {
  return Boolean(
    process.env["STRIPE_SECRET_KEY"] &&
      process.env["STRIPE_MEMBERSHIP_PRICE_ID"],
  );
}

/**
 * Which cadence somebody is buying.
 *
 * Here rather than in `stripe.ts` for this file's founding reason: the
 * checkout button is a client component and needs the name of the thing it
 * is asking for, and importing that name from the module that begins
 * `import Stripe from "stripe"` would put nineteen megabytes of SDK behind a
 * union of two strings. A type is erased at build time; the import it
 * arrives through is not.
 */
export type MembershipPlan = "monthly" | "annual";

/**
 * Whether the year-at-a-time price exists to be sold.
 *
 * Separate from `membershipConfigured` and deliberately not folded into it.
 * The monthly price is what decides whether membership is on sale at all —
 * without it the offer disappears from the footer, the nav and the page. The
 * annual one is an addition to a working offer, so a missing id here hides
 * one button rather than switching off payments, and the site stays sellable
 * in the window between creating one price in Stripe and creating the other.
 */
export function annualOffered(): boolean {
  return (
    membershipConfigured() &&
    Boolean(process.env["STRIPE_MEMBERSHIP_PRICE_ID_ANNUAL"])
  );
}
