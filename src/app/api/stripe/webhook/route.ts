import process from "node:process";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { updateMemberByCustomer, upsertMember } from "@/lib/members/repository";
import { stripeClient, subscriptionPeriodEnd } from "@/lib/stripe";

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

async function handleCheckout(session: Stripe.Checkout.Session): Promise<void> {
  const { customer } = session;
  const email = session.metadata?.["email"] ?? session.customer_email;
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

  await upsertMember({
    email,
    stripeCustomerId: customer,
    stripeSubscriptionId: subscriptionId,
    status: subscription?.status ?? "active",
    currentPeriodEnd:
      subscription === null ? null : subscriptionPeriodEnd(subscription),
  });
}

async function handleSubscription(
  subscription: Stripe.Subscription,
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
    });
    return;
  }

  await upsertMember({
    email,
    stripeCustomerId: customer,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    currentPeriodEnd: periodEnd,
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

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckout(event.data.object);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscription(event.data.object);
        break;
      case "invoice.paid":
      case "invoice.payment_failed": {
        /*
         * The invoice carries the outcome, the subscription carries the
         * status Stripe derived from it — `past_due`, `unpaid`, `active`
         * again after a retry. Reading the subscription means access follows
         * Stripe's own dunning rules rather than a rule invented here.
         */
        const invoice = event.data.object;
        const subscriptionId = (
          invoice as unknown as { subscription?: string | { id: string } }
        ).subscription;
        const id =
          typeof subscriptionId === "string"
            ? subscriptionId
            : (subscriptionId?.id ?? null);
        if (id !== null) {
          await handleSubscription(
            await stripeClient().subscriptions.retrieve(id),
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
