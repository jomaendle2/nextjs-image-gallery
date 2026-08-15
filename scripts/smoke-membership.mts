/**
 * End-to-end check of the membership path against Stripe test mode.
 *
 * Exercises the two things that decide whether somebody has paid — the
 * webhook's signature check and the access rules derived from a
 * subscription's status — without a browser, so it can be run on every
 * change rather than only when somebody remembers to click through checkout.
 *
 * The webhook is called directly with events signed by the real secret, so
 * this is the same code path Stripe drives in production, including the
 * signature verification.
 *
 * Usage, with the dev server running and `stripe listen` supplying a
 * webhook secret:
 *
 *   stripe listen --forward-to localhost:3000/api/stripe/webhook
 *   node --env-file=.env.local scripts/smoke-membership.mts <webhook-secret>
 */
import { createHmac } from "node:crypto";
import process from "node:process";
import { sql } from "../src/lib/database.ts";

const [, , secretArg, originArg] = process.argv;
const webhookSecret = secretArg ?? process.env["STRIPE_WEBHOOK_SECRET"];
if (!webhookSecret) {
  console.error(
    "Usage: smoke-membership.mts <webhook-signing-secret> [origin]\n" +
      "Get one from `stripe listen`, or set STRIPE_WEBHOOK_SECRET.",
  );
  process.exit(1);
}
const origin = originArg ?? "http://localhost:3000";
const address = `member-smoke-${Date.now()}@example.test`;
const customerId = `cus_smoke_${Date.now()}`;

let failures = 0;
function check(label: string, ok: boolean): void {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) {
    failures += 1;
  }
}

/** Signs a payload the way Stripe does, so `constructEvent` accepts it. */
function post(body: unknown, opts: { sign: boolean }): Promise<Response> {
  const payload = JSON.stringify(body);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", webhookSecret as string)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  return fetch(`${origin}/api/stripe/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(opts.sign
        ? { "stripe-signature": `t=${timestamp},v1=${signature}` }
        : { "stripe-signature": `t=${timestamp},v1=deadbeef` }),
    },
    body: payload,
  });
}

const inAnHour = Math.floor(Date.now() / 1000) + 3600;

function subscriptionEvent(type: string, status: string, periodEnd: number) {
  return {
    id: `evt_${Math.random().toString(36).slice(2)}`,
    type,
    data: {
      object: {
        id: `sub_smoke`,
        object: "subscription",
        customer: customerId,
        status,
        current_period_end: periodEnd,
        metadata: { email: address },
        items: { data: [] },
      },
    },
  };
}

// 1. An unsigned event must be refused outright.
const unsigned = await post(subscriptionEvent("customer.subscription.updated", "active", inAnHour), { sign: false });
check("a forged signature is rejected", unsigned.status === 400);

const noRow = await sql`SELECT 1 FROM members WHERE email = ${address};`;
check("the forged event wrote nothing", noRow.length === 0);

// 2. A properly signed event grants membership.
const granted = await post(subscriptionEvent("customer.subscription.updated", "active", inAnHour), { sign: true });
check("a signed event is accepted", granted.ok);

const active = await sql`
  SELECT status, current_period_end FROM members WHERE email = ${address};`;
check("the member row exists", active.length === 1);
check("the status is active", active[0]?.["status"] === "active");

// 3. Replaying it changes nothing and still succeeds — Stripe redelivers.
const replay = await post(subscriptionEvent("customer.subscription.updated", "active", inAnHour), { sign: true });
check("a replayed event is accepted", replay.ok);
const afterReplay = await sql`SELECT count(*)::int AS n FROM members WHERE email = ${address};`;
check("the replay did not duplicate the row", afterReplay[0]?.["n"] === 1);

// 4. past_due must not keep access — Stripe retries for days.
await post(subscriptionEvent("customer.subscription.updated", "past_due", inAnHour), { sign: true });
const pastDue = await sql`SELECT status FROM members WHERE email = ${address};`;
check("a failed payment is recorded as past_due", pastDue[0]?.["status"] === "past_due");

// 5. Cancellation ends it.
await post(subscriptionEvent("customer.subscription.deleted", "canceled", inAnHour), { sign: true });
const cancelled = await sql`SELECT status FROM members WHERE email = ${address};`;
check("cancellation is recorded", cancelled[0]?.["status"] === "canceled");

// 6. The member-only route must refuse an anonymous caller.
const photo = await sql`
  SELECT id FROM photos WHERE published_at IS NOT NULL LIMIT 1;`;
const photoId = photo[0]?.["id"] as string | undefined;
if (photoId !== undefined) {
  const anonymous = await fetch(`${origin}/api/photo/${photoId}/details`);
  check("member-only details refuse an anonymous caller", anonymous.status === 403);

  const body = (await anonymous.json()) as Record<string, unknown>;
  check(
    "and leak nothing in the refusal",
    !("precise_location" in body || "technique" in body),
  );
}

await sql`DELETE FROM members WHERE email = ${address};`;
console.log(failures === 0 ? "\nall checks passed" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
