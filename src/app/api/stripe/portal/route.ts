import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/auth/session";
import { getMemberByEmail } from "@/lib/members/repository";
import { clientIp, stripeLimiter } from "@/lib/rate-limit";
import { siteOrigin } from "@/lib/site-url";
import { stripeClient } from "@/lib/stripe";

/**
 * A door out, hosted by Stripe.
 *
 * Cancelling, swapping a card, and downloading invoices are all things a
 * subscriber is entitled to do without asking a human, and all things this
 * site would otherwise have to build — badly, since each one is a form over
 * money. The portal is Stripe's, so the card never touches this origin and
 * a cancellation is recorded by the same webhook that recorded the sale.
 *
 * Note what this route does *not* do: it never cancels anything itself. It
 * mints a link to a session scoped to one customer and stops. Membership is
 * still only ever written by a signed Stripe event.
 */
export async function POST(): Promise<NextResponse> {
  /*
   * A limiter on an unauthenticated route that spends money elsewhere.
   * Every call creates a live object in a metered Stripe account.
   */
  const limitKey = clientIp(await headers());
  if (!stripeLimiter.check(limitKey)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429 },
    );
  }

  const email = await getSessionEmail();
  if (email === null) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  /*
   * The customer id comes from our own row for the signed-in address, never
   * from the request. Accepting one from the client would let any member
   * open any other member's billing history by guessing a `cus_` id — the
   * portal session is the authorisation, so minting it is the moment that
   * has to be got right.
   */
  const member = await getMemberByEmail(email);
  if (member === null) {
    return NextResponse.json(
      { error: "That address has no membership." },
      { status: 404 },
    );
  }

  try {
    const session = await stripeClient().billingPortal.sessions.create({
      customer: member.stripe_customer_id,
      return_url: `${siteOrigin()}/membership`,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    /*
     * The usual cause is the portal having no configuration saved in the
     * Stripe dashboard, which is a setup step rather than a code one. Said
     * plainly in the log, because the message the subscriber sees cannot be.
     */
    console.error(
      "Could not open the billing portal (is it configured in Stripe?):",
      error,
    );
    return NextResponse.json(
      { error: "Could not open the billing portal." },
      { status: 502 },
    );
  }
}
