import process from "node:process";
import Stripe from "stripe";

/**
 * The Stripe client, and the price a membership is sold at.
 *
 * Keys come from the Vercel Marketplace integration rather than being typed
 * into a dashboard by hand, so the same names resolve in development,
 * preview and production.
 *
 * Read lazily rather than at module load. `STRIPE_SECRET_KEY` is only needed
 * on the two routes that talk to Stripe, and throwing at import time would
 * take down the gallery — which has no interest in payments at all — the
 * moment a key went missing.
 */

export function stripeClient(): Stripe {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (key === undefined || key === "") {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }
  return new Stripe(key);
}

/**
 * The price to sell. Created once in the Stripe dashboard and referenced by
 * id, because a price created in code on every checkout would litter the
 * account with duplicates and make revenue impossible to read.
 */
export function membershipPriceId(): string {
  const id = process.env["STRIPE_MEMBERSHIP_PRICE_ID"];
  if (id === undefined || id === "") {
    throw new Error("STRIPE_MEMBERSHIP_PRICE_ID is not set.");
  }
  return id;
}

/** Whether membership is configured at all, for hiding the UI when it is not. */
export function membershipConfigured(): boolean {
  return Boolean(
    process.env["STRIPE_SECRET_KEY"] &&
      process.env["STRIPE_MEMBERSHIP_PRICE_ID"],
  );
}

/**
 * Stripe reports period ends as Unix seconds; Postgres wants a timestamp.
 * Null when Stripe did not send one, which happens on events that describe a
 * subscription without renewing it.
 */
export function periodEndToIso(
  seconds: number | null | undefined,
): string | null {
  return typeof seconds === "number"
    ? new Date(seconds * 1000).toISOString()
    : null;
}

/**
 * When the paid-for period actually ends.
 *
 * Stripe moved `current_period_end` off the subscription and onto its items,
 * so reading it from the top level — as this did — returned `undefined`
 * every time and stored NULL for every member. Nothing looked broken,
 * because `isActive` reads a null period end as "no expiry recorded" and
 * falls back to the status, and the status is correct in the ordinary case.
 * The cost was silent: the period end was documented as a second line of
 * defence and was in fact never populated, so a missed
 * `customer.subscription.deleted` would have meant access with no end.
 *
 * Items are read rather than the subscription because that is where the
 * field lives now. The latest end across items is the right one for a
 * multi-item subscription: access should outlast the last thing paid for,
 * not the first.
 */
export function subscriptionPeriodEnd(
  subscription: Stripe.Subscription,
): string | null {
  const ends = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value): value is number => typeof value === "number");

  if (ends.length > 0) {
    return periodEndToIso(Math.max(...ends));
  }

  /*
   * Older API versions put it on the subscription itself. Kept as a
   * fallback so an account pinned to an earlier version still records a
   * boundary rather than silently recording none.
   */
  return periodEndToIso(
    (subscription as unknown as { current_period_end?: number })
      .current_period_end,
  );
}
