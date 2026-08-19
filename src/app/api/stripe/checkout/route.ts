import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/auth/session";
import { annualOffered, type MembershipPlan } from "@/lib/members/offer";
import { getMemberByEmail } from "@/lib/members/repository";
import { hasLiveSubscription } from "@/lib/members/status";
import { clientIp, stripeLimiter } from "@/lib/rate-limit";
import { siteOrigin } from "@/lib/site-url";
import { membershipPriceId, stripeClient } from "@/lib/stripe";

/**
 * How Stripe should address the buyer, of which there are exactly three
 * kinds: one we have billed before, one we know but have not billed, and one
 * we have never met.
 *
 * Only the last is asked for an address. Fixing it where we already know it
 * means Stripe shows it as unchangeable, so a signed-in person cannot end up
 * with a subscription attached to an inbox their session does not open.
 */
function whoIsBuying(
  customerId: string | null,
  email: string | null,
): { customer: string } | { customer_email: string } | Record<string, never> {
  if (customerId !== null) {
    return { customer: customerId };
  }
  return email === null ? {} : { customer_email: email };
}

/**
 * Which cadence the button asked for, believing nothing.
 *
 * This is an unauthenticated route, so the body is a stranger's text rather
 * than an argument: anything that is not the exact string `"annual"` is
 * monthly, including a malformed body, no body at all, and a `plan` of
 * `{ toString: … }`. The failure direction matters — an unrecognised value
 * must fall to the cheaper price, never the dearer one.
 *
 * `annualOffered()` is checked here rather than trusted from the page. The
 * button is hidden when no annual price exists, but hiding a control is a
 * statement about the page and not about the endpoint, and this endpoint
 * answers to anybody who can POST. Without this line a crafted request would
 * reach `membershipPriceId("annual")` and throw a 502 naming an environment
 * variable.
 */
async function requestedPlan(request: Request): Promise<MembershipPlan> {
  if (!annualOffered()) {
    return "monthly";
  }
  try {
    const body: unknown = await request.json();
    const plan =
      typeof body === "object" && body !== null
        ? (body as { plan?: unknown }).plan
        : undefined;
    return plan === "annual" ? "annual" : "monthly";
  } catch {
    // No body, or not JSON. Both mean the monthly button.
    return "monthly";
  }
}

/**
 * Starts a subscription checkout, for a signed-in member or a new one.
 *
 * No session is required, though the reasoning that a membership is
 * keyed on an email address and letting somebody type a different one would
 * buy access for an inbox they may not own. That reasoning was sound and the
 * rule built from it was not: signing in requires already being a
 * contributor or a member, so requiring a session to *become* a member made
 * the two conditions circular and nobody new could ever buy anything.
 *
 * So an anonymous buyer is allowed, and Stripe collects the address. The
 * protection the old rule was reaching for survives intact, because it never
 * lived here: buying grants nothing by itself. Membership is only usable
 * through a session, a session only comes from a link sent to the address on
 * the payment, and so control of that inbox still has to be proved before
 * anything is unlocked. Paying for the wrong address costs the buyer a
 * refund request, not somebody else their privacy.
 *
 * A signed-in buyer still gets their address fixed rather than collected —
 * there is no reason to ask again for something we already know.
 */
export async function POST(request: Request): Promise<NextResponse> {
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

  /*
   * Somebody Stripe is already billing does not need a second subscription.
   * This asks about billing rather than access: a `trialing` member has
   * access and a `past_due` one does not, but both already have a
   * subscription that will charge them, and starting another would bill
   * twice for the same month.
   *
   * Only checkable for a signed-in buyer. An anonymous one is identified by
   * whatever they type at Stripe, which we do not learn until the webhook —
   * so the duplicate check for them is Stripe's own, plus the 409 they will
   * get if they sign in and try again.
   */
  const existing = email === null ? null : await getMemberByEmail(email);
  if (hasLiveSubscription(existing)) {
    return NextResponse.json(
      {
        /*
         * The next step, not just the refusal. A buyer who reaches this has
         * usually forgotten they already subscribed, and "you already have
         * one" without a way to use it is where they get stuck.
         */
        error:
          "That address already has a membership — sign in with it to use it.",
      },
      { status: 409 },
    );
  }

  const origin = siteOrigin();
  const plan = await requestedPlan(request);

  try {
    const session = await stripeClient().checkout.sessions.create({
      mode: "subscription",
      /*
       * No `payment_method_types`. Stripe decides what to offer from the
       * account's own settings, and hardcoding `["card"]` would quietly
       * switch off every other method a subscriber might have used.
       */
      line_items: [{ price: membershipPriceId(plan), quantity: 1 }],
      ...whoIsBuying(existing?.stripe_customer_id ?? null, email),
      /*
       * Carried through to the webhook when we have it. Stripe's own
       * `customer_email` can be absent on later subscription events, and
       * this is the field that ties a payment back to a session on this
       * site. Omitted entirely for an anonymous buyer rather than written as
       * null — the webhook falls back to the address Stripe collected, and
       * an empty string here would look like an answer.
       */
      ...(email === null
        ? {}
        : {
            subscription_data: { metadata: { email } },
            metadata: { email },
          }),
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
