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
