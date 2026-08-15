import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/auth/session";
import { getMemberByEmail } from "@/lib/members/repository";
import { hasLiveSubscription } from "@/lib/members/status";
import { siteOrigin } from "@/lib/site-url";
import { membershipPriceId, stripeClient } from "@/lib/stripe";

/**
 * Starts a subscription checkout for whoever is signed in.
 *
 * Signing in first is deliberate. The membership is keyed on an email
 * address — the same address that receives the magic link — so letting
 * somebody type a different one at Stripe's checkout would buy access for
 * an inbox they may not own, and leave the payment attached to a person who
 * cannot sign in to use it.
 *
 * `customer_email` is passed rather than collected for the same reason:
 * Stripe shows it as fixed, and the address that comes back on the webhook
 * is the one we already trust.
 */
export async function POST(): Promise<NextResponse> {
  const email = await getSessionEmail();
  if (email === null) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  /*
   * Somebody Stripe is already billing does not need a second subscription.
   * This asks about billing rather than access: a `trialing` member has
   * access and a `past_due` one does not, but both already have a
   * subscription that will charge them, and starting another would bill
   * twice for the same month.
   */
  const existing = await getMemberByEmail(email);
  if (hasLiveSubscription(existing)) {
    return NextResponse.json(
      { error: "That address already has a membership." },
      { status: 409 },
    );
  }

  const origin = siteOrigin();

  try {
    const session = await stripeClient().checkout.sessions.create({
      mode: "subscription",
      /*
       * No `payment_method_types`. Stripe decides what to offer from the
       * account's own settings, and hardcoding `["card"]` would quietly
       * switch off every other method a subscriber might have used.
       */
      line_items: [{ price: membershipPriceId(), quantity: 1 }],
      customer_email: existing?.stripe_customer_id ? undefined : email,
      ...(existing?.stripe_customer_id
        ? { customer: existing.stripe_customer_id }
        : {}),
      /*
       * Carried through to the webhook. Stripe's own `customer_email` can be
       * absent on later subscription events, and this is the field that ties
       * a payment back to a session on this site.
       */
      subscription_data: { metadata: { email } },
      metadata: { email },
      success_url: `${origin}/membership?welcome=1`,
      cancel_url: `${origin}/membership`,
    });

    if (session.url === null) {
      throw new Error("Stripe returned a session with no URL.");
    }
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Could not start checkout:", error);
    return NextResponse.json(
      { error: "Could not start checkout." },
      { status: 502 },
    );
  }
}
