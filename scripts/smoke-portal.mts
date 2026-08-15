/**
 * The membership from the member's side.
 *
 * `smoke-membership.mts` proves the webhook cannot be forged; this proves
 * the other half — that somebody who has genuinely paid gets what they paid
 * for, and that the boundaries hold when their card starts failing. It uses
 * a real Stripe customer, a real `members` row and a real session cookie,
 * because the interesting failures live in how those three agree.
 *
 * The case worth keeping is the last pair: a past-due member must lose the
 * content and keep the portal. Those pull in opposite directions, and any
 * change that collapses `isActive` and `hasLiveSubscription` into one
 * predicate will fail here rather than in production.
 *
 * Cleans up after itself, including the Stripe customer.
 *
 * Usage, with the dev server running:
 *
 *   node --env-file=.env.local scripts/smoke-portal.mts
 *
 * Requires a billing portal configuration — run
 * `scripts/setup-billing-portal.mts` first if this reports a 502.
 */
import process from "node:process";
import Stripe from "stripe";
import { generateSecret, hashSecret } from "../src/lib/auth/secrets.ts";
import { sql } from "../src/lib/database.ts";

const origin = "http://localhost:3000";
const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"] as string);
const address = `portal-e2e-${Date.now()}@example.test`;

let failures = 0;
const check = (label: string, ok: boolean) => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) {
    failures += 1;
  }
};

// A customer that really exists in Stripe, as a member's would.
const customer = await stripe.customers.create({ email: address });

await sql`
  INSERT INTO members (email, stripe_customer_id, status, current_period_end)
  VALUES (${address}, ${customer.id}, 'active', now() + interval '30 days');`;

const secret = generateSecret();
await sql`
  INSERT INTO sessions (id, contributor_id, email, expires_at)
  VALUES (${hashSecret(secret)}, NULL, ${address}, now() + interval '1 day');`;

const cookie = `gallery_session=${secret}`;

// 1. A signed-in member gets a portal URL on Stripe's domain.
const opened = await fetch(`${origin}/api/stripe/portal`, {
  method: "POST",
  headers: { cookie },
});
const body = (await opened.json()) as { url?: string; error?: string };
check("a member can open the portal", opened.ok);
check(
  "and the URL is Stripe's, not ours",
  typeof body.url === "string" &&
    body.url.startsWith("https://billing.stripe.com/"),
);
if (!opened.ok) {
  console.log("    ->", JSON.stringify(body));
}

// 2. That member may not check out again — they are already billed.
const again = await fetch(`${origin}/api/stripe/checkout`, {
  method: "POST",
  headers: { cookie },
});
check("an existing subscriber cannot buy a second one", again.status === 409);

// 3. The member-only content they paid for is actually served.
const photo = await sql`
  SELECT id FROM photos WHERE published_at IS NOT NULL LIMIT 1;`;
const photoId = photo[0]?.["id"] as string;
const details = await fetch(`${origin}/api/photo/${photoId}/details`, {
  headers: { cookie },
});
const detailBody = (await details.json()) as Record<string, unknown>;
check(
  "a member receives the paid content",
  details.ok && detailBody["member"] === true,
);
check(
  "and it is not cached by anything in between",
  (details.headers.get("cache-control") ?? "").includes("no-store"),
);

// 4. A member who is past due keeps billing access but loses content.
await sql`UPDATE members SET status = 'past_due' WHERE email = ${address};`;
const lapsed = await fetch(`${origin}/api/photo/${photoId}/details`, {
  headers: { cookie },
});
check("a past-due member loses the content", lapsed.status === 403);
const lapsedPortal = await fetch(`${origin}/api/stripe/portal`, {
  method: "POST",
  headers: { cookie },
});
check("but can still reach the portal to fix their card", lapsedPortal.ok);

await sql`DELETE FROM sessions WHERE email = ${address};`;
await sql`DELETE FROM members WHERE email = ${address};`;
await stripe.customers.del(customer.id);

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
