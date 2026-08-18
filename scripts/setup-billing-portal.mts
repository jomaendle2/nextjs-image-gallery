/**
 * Creates the billing portal configuration the membership needs.
 *
 * Stripe will not mint a portal session until the account has a
 * configuration saved, and a fresh account has none — so without this the
 * "Manage or cancel your membership" button returns 502 and the only way to
 * leave is to email somebody. It is a script rather than a dashboard click
 * because it has to be done once per mode: test today, live before launch,
 * and the two should not drift.
 *
 * Idempotent by search: an existing configuration created by this script is
 * updated rather than duplicated, so it can be re-run after editing.
 *
 * Usage:
 *
 *   node --env-file=.env.local scripts/setup-billing-portal.mts
 *
 * Run it again with live keys in the environment before taking real money.
 */
import process from "node:process";
import Stripe from "stripe";
import { siteOrigin } from "../src/lib/site-url.ts";

const key = process.env["STRIPE_SECRET_KEY"];
if (key === undefined || key === "") {
  console.error("STRIPE_SECRET_KEY is not set.");
  process.exit(1);
}

const stripe = new Stripe(key);
const mode = key.startsWith("sk_live_") ? "LIVE" : "test";

/*
 * The same resolution the app uses, imported rather than re-implemented.
 * These scripts each had their own idea of the origin — one reading
 * NEXT_PUBLIC_SITE_URL, which nothing in the application sets or reads — so
 * configuring the site correctly left the scripts pointing somewhere else.
 * The portal's return URL is the one that matters here: get it wrong and a
 * member who cancels is returned to a domain that is not this one.
 */
const origin = siteOrigin();

/*
 * What a subscriber may do without asking a human.
 *
 * Cancellation is `immediately: false` — at period end — because they have
 * paid for the current month and taking it away the moment they click is
 * both unkind and a refund question nobody wants. `subscription_update` is
 * left off: there is one price, so a plan switcher would be a menu of one.
 */
const features: Stripe.BillingPortal.ConfigurationCreateParams.Features = {
  customer_update: {
    enabled: true,
    allowed_updates: ["email", "address", "tax_id"],
  },
  invoice_history: { enabled: true },
  payment_method_update: { enabled: true },
  subscription_cancel: {
    enabled: true,
    mode: "at_period_end",
    cancellation_reason: {
      enabled: true,
      options: [
        "too_expensive",
        "missing_features",
        "unused",
        "customer_service",
        "other",
      ],
    },
  },
};

/*
 * `privacy_policy_url` and `terms_of_service_url` are deliberately absent:
 * this site has neither page yet, and pointing Stripe's portal at two 404s
 * is worse than pointing it nowhere. Both are required before taking real
 * money from Germany — see docs/security-review.md — and both belong here
 * the moment they exist.
 */
const businessProfile = {
  headline: "the beauty of earth. — your membership",
};

const existing = await stripe.billingPortal.configurations.list({ limit: 100 });
const mine = existing.data.find(
  (configuration) =>
    configuration.metadata?.["managed_by"] === "beauty-of-earth",
);

if (mine === undefined) {
  const created = await stripe.billingPortal.configurations.create({
    business_profile: businessProfile,
    features,
    default_return_url: `${origin}/membership`,
    metadata: { managed_by: "beauty-of-earth" },
  });
  console.log(`Created ${mode} portal configuration ${created.id}`);
} else {
  const updated = await stripe.billingPortal.configurations.update(mine.id, {
    business_profile: businessProfile,
    features,
    default_return_url: `${origin}/membership`,
  });
  console.log(`Updated ${mode} portal configuration ${updated.id}`);
}

console.log(
  "Members can now update a card, read invoices, and cancel at period end.",
);
