import process from "node:process";
import Stripe from "stripe";
import type { MembershipPlan } from "@/lib/members/offer";

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

/**
 * Pinned deliberately.
 *
 * Two silent failures in this integration came from Stripe moving a field
 * between versions — `current_period_end` onto subscription items, and
 * `invoice.subscription` under `parent` — each read through a cast that
 * compiled fine and returned undefined for months. Pinning does not prevent
 * a move, but it makes the next one happen when somebody changes this line,
 * rather than on a Tuesday when Stripe rolls an account forward.
 *
 * Important and not covered by this: **outbound calls use this version,
 * while the event objects Stripe delivers are serialised in the version the
 * webhook endpoint was created with.** They can disagree, and the two
 * helpers above read the new shape first for exactly that reason. Check the
 * endpoint's version in the Dashboard matches this string.
 */
const API_VERSION = "2026-07-29.dahlia";

export function stripeClient(): Stripe {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (key === undefined || key === "") {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }
  return new Stripe(key, { apiVersion: API_VERSION });
}

/**
 * The price to sell, at the cadence asked for. Created once in the Stripe
 * dashboard and referenced by id, because a price created in code on every
 * checkout would litter the account with duplicates and make revenue
 * impossible to read.
 *
 * Two ids rather than one price with two intervals, because Stripe has no
 * such object: an interval is a property of a price, so a monthly and a
 * yearly membership are two prices that happen to grant the same thing.
 * Which is also why the webhook needs no change for this — it reads the
 * subscription's status and period end, and neither knows or cares which of
 * the two was bought.
 *
 * Throws rather than falling back to the monthly id when the annual one is
 * missing. A silent fallback would charge €5 for a button that said €45 and
 * the buyer would find out on the receipt; `annualOffered()` is what keeps
 * that button off the page in the first place, and this is the assertion
 * that it did its job.
 */
export function membershipPriceId(plan: MembershipPlan = "monthly"): string {
  const variable =
    plan === "annual"
      ? "STRIPE_MEMBERSHIP_PRICE_ID_ANNUAL"
      : "STRIPE_MEMBERSHIP_PRICE_ID";
  const id = process.env[variable];
  if (id === undefined || id === "") {
    throw new Error(`${variable} is not set.`);
  }
  return id;
}

/*
 * `membershipConfigured` used to be here and is now in
 * `src/lib/members/offer.ts`. It reads the same two environment variables
 * this file does, but its callers — the site footer and the membership
 * page — want nothing else from Stripe, and importing it from here handed
 * them the whole SDK to deploy. Anything else that only asks *whether*
 * payments are configured belongs there rather than here.
 */

/**
 * Stripe reports period ends as Unix seconds; Postgres wants a timestamp.
 * Null when Stripe did not send one, which happens on events that describe a
 * subscription without renewing it.
 */
function periodEndToIso(seconds: number | null | undefined): string | null {
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

/**
 * The subscription an invoice belongs to.
 *
 * Stripe moved this. It is no longer `invoice.subscription` but
 * `invoice.parent.subscription_details.subscription`, and the code here read
 * the old place through an `as unknown as` cast — so it resolved to
 * `undefined` on every event and both invoice handlers did nothing at all.
 * A member's card could fail, Stripe could move them to `past_due`, and the
 * status would never be written by this path.
 *
 * This is the second time a cast around a moved Stripe field has hidden a
 * silent failure in this file — see `subscriptionPeriodEnd`. Both were the
 * library reporting a real API change and being overruled. Neither cast is
 * gone here, because the runtime shape genuinely varies by account API
 * version, but both now read the current location first and fall back, and
 * both are covered by a smoke test that sends the real event shape.
 */
export function subscriptionFromInvoice(
  invoice: Stripe.Invoice,
): string | null {
  const parent = invoice.parent?.subscription_details?.subscription;
  const legacy = (
    invoice as unknown as { subscription?: string | { id: string } }
  ).subscription;

  for (const candidate of [parent, legacy]) {
    if (typeof candidate === "string" && candidate !== "") {
      return candidate;
    }
    if (typeof candidate === "object" && candidate !== null) {
      return candidate.id;
    }
  }
  return null;
}
