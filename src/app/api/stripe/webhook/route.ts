import process from "node:process";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { updateMemberByCustomer, upsertMember } from "@/lib/members/repository";
import {
  stripeClient,
  subscriptionFromInvoice,
  subscriptionPeriodEnd,
} from "@/lib/stripe";

/**
 * Stripe's account of who has paid, which is the only account that counts.
 *
 * Membership is never written from a success page. A redirect back from
 * checkout proves only that a browser followed a URL, and that URL is
 * guessable; this endpoint is the one place `members` is written, and every
 * write happens after a signature check.
 *
 * Handled events, and why each:
 *
 *   checkout.session.completed        somebody just subscribed
 *   customer.subscription.updated     renewal, plan change, cancellation
 *                                     scheduled at period end
 *   customer.subscription.deleted     access ends now
 *   invoice.paid                      a renewal actually cleared
 *   invoice.payment_failed            it did not — Stripe will retry, and
 *                                     the status it sets decides access
 *
 * Everything here is idempotent, because Stripe redelivers on any non-2xx
 * and events can arrive out of order: a subscription update that overtakes
 * its own checkout completion still lands, and a replay writes the same row.
 */

/** The address a subscription belongs to, as recorded at checkout. */
function emailFrom(subscription: Stripe.Subscription): string | null {
  const fromMetadata = subscription.metadata["email"];
  return typeof fromMetadata === "string" && fromMetadata !== ""
    ? fromMetadata
    : null;
}

async function handleCheckout(
  session: Stripe.Checkout.Session,
  eventAt: string,
): Promise<void> {
  const { customer } = session;
  /*
   * In preference order: the address we fixed at checkout for a signed-in
   * buyer, then the one Stripe collected from an anonymous one.
   * `customer_details.email` is where Stripe puts what the buyer actually
   * typed; `customer_email` only holds what we passed in, so for a new
   * member it is null and the details are the only record of who paid.
   */
  const email =
    session.metadata?.["email"] ??
    session.customer_details?.email ??
    session.customer_email;
  if (typeof email !== "string" || typeof customer !== "string") {
    console.error("Checkout completed without an email or customer id.");
    return;
  }

  /*
   * The session says a subscription exists but not when it renews, so it is
   * fetched rather than guessed. Getting this wrong would either lock a
   * paying member out or leave a cancelled one with access.
   */
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription?.id ?? null);

  const subscription =
    subscriptionId === null
      ? null
      : await stripeClient().subscriptions.retrieve(subscriptionId);

  const outcome = await upsertMember({
    email,
    stripeCustomerId: customer,
    stripeSubscriptionId: subscriptionId,
    status: subscription?.status ?? "active",
    currentPeriodEnd:
      subscription === null ? null : subscriptionPeriodEnd(subscription),
    eventAt,
  });

  /*
   * We refused to record this payment, so we must not keep it.
   *
   * `wrong-customer` means the address already belongs to a different Stripe
   * customer. There are two ways to arrive here and cancelling is right for
   * both: somebody trying to seize another person's membership, who should
   * get their money back rather than a foothold; and a genuine subscriber
   * who checked out twice while signed out — Checkout mints a fresh customer
   * each time, so they would otherwise be billed monthly, twice, for a
   * subscription with no row and no way to reach the portal and cancel it.
   *
   * Taking money for a membership we have declined to grant is the one
   * outcome that is indefensible either way.
   */
  if (outcome === "wrong-customer") {
    if (subscriptionId !== null) {
      try {
        await stripeClient().subscriptions.cancel(subscriptionId);
        console.error(
          `Cancelled subscription ${subscriptionId}: its address already ` +
            "belongs to another Stripe customer, so it was never recorded.",
        );
      } catch (error) {
        console.error(
          `Could not cancel refused subscription ${subscriptionId}. It is ` +
            "billing with no membership row — cancel it in the Dashboard:",
          error,
        );
      }
    }
    return;
  }

  /*
   * A stale event, superseded by one that already landed. Nothing to do, and
   * nothing to label — writing the address onto the subscription now would
   * be acting on an out-of-date view of who owns it.
   */
  if (outcome !== "written") {
    return;
  }

  /*
   * Write the address onto the subscription when we did not set it at
   * checkout, which is every anonymous purchase.
   *
   * Without this, later events for that subscription carry no email and can
   * only be matched on the customer id — which works only for as long as the
   * row written just above survives. With it, any future renewal or
   * cancellation is self-describing and can rebuild the row from scratch.
   * Failing to record it is not worth losing the payment over, so it does not
   * throw: the row is already correct, and this only affects what happens
   * next time.
   */
  if (subscriptionId !== null && session.metadata?.["email"] === undefined) {
    try {
      await stripeClient().subscriptions.update(subscriptionId, {
        metadata: { email },
      });
    } catch (error) {
      console.error("Could not label the subscription with its email:", error);
    }
  }
}

async function handleSubscription(
  subscription: Stripe.Subscription,
  eventAt: string,
): Promise<void> {
  const customer =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  const periodEnd = subscriptionPeriodEnd(subscription);
  const email = emailFrom(subscription);

  /*
   * Matched on the customer id when there is no address, because a
   * cancellation identifies an account rather than a person. Upserting on
   * the email when we have it also covers the case where the row is missing
   * entirely — a subscription created outside checkout, say.
   */
  if (email === null) {
    await updateMemberByCustomer({
      stripeCustomerId: customer,
      status: subscription.status,
      currentPeriodEnd: periodEnd,
      eventAt,
    });
    return;
  }

  await upsertMember({
    email,
    stripeCustomerId: customer,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    currentPeriodEnd: periodEnd,
    eventAt,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env["STRIPE_WEBHOOK_SECRET"];
  if (secret === undefined || secret === "") {
    console.error("STRIPE_WEBHOOK_SECRET is not set; refusing the event.");
    return NextResponse.json({ error: "Not configured." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (signature === null) {
    return NextResponse.json({ error: "Unsigned." }, { status: 400 });
  }

  /*
   * The raw body, before anything parses it. `constructEvent` hashes exactly
   * these bytes, so re-serialising a parsed object would fail every time —
   * and the check is the only thing standing between this endpoint and
   * anybody who can POST JSON granting themselves a membership.
   */
  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(raw, signature, secret);
  } catch (error) {
    console.error("Rejected a Stripe event with a bad signature:", error);
    return NextResponse.json({ error: "Bad signature." }, { status: 400 });
  }

  /*
   * Stripe stamps every event with its creation time, which is the only
   * ordering this integration can rely on — delivery order is not it.
   *
   * Falling back to now, rather than letting a missing or malformed
   * `created` throw. An event that has passed the signature check is
   * genuinely from Stripe and must be processed; treating it as current is
   * the same behaviour this had before ordering existed, and is strictly
   * better than a 500 that makes Stripe redeliver it for three days.
   */
  const created = event.created * 1000;
  const eventAt = new Date(
    Number.isFinite(created) ? created : Date.now(),
  ).toISOString();

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckout(event.data.object, eventAt);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscription(event.data.object, eventAt);
        break;
      case "invoice.paid":
      case "invoice.payment_failed": {
        /*
         * The invoice carries the outcome, the subscription carries the
         * status Stripe derived from it — `past_due`, `unpaid`, `active`
         * again after a retry. Reading the subscription means access follows
         * Stripe's own dunning rules rather than a rule invented here.
         */
        const id = subscriptionFromInvoice(event.data.object);
        if (id !== null) {
          await handleSubscription(
            await stripeClient().subscriptions.retrieve(id),
            eventAt,
          );
        }
        break;
      }
      default:
        // Everything else is acknowledged and ignored, so Stripe stops
        // redelivering events this integration has no opinion about.
        break;
    }
  } catch (error) {
    /*
     * A 500 makes Stripe retry, which is what we want for a database blip.
     * The alternative — swallowing it — would leave somebody who has paid
     * without access and no further event coming to correct it.
     */
    console.error(`Handling ${event.type} failed:`, error);
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
