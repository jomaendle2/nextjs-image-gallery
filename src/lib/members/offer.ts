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
