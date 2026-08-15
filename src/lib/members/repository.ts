import { normaliseEmail } from "@/lib/auth/slug";
import { sql } from "@/lib/database";

export interface Member {
  email: string;
  stripe_customer_id: string;
  status: string;
  current_period_end: string | null;
}

/**
 * Membership, as Stripe reports it.
 *
 * Every write here comes from a verified webhook. Nothing in this module is
 * called from a success page or a redirect, because arriving at a URL is not
 * evidence of having paid — anyone can guess `?success=true`.
 */

/**
 * True when the subscription entitles somebody to member-only content.
 *
 * `active` and `trialing` both count; `past_due` deliberately does not.
 * Stripe keeps retrying a failed payment for days, and continuing to serve
 * paid content through that window is a decision, not a default — the
 * period end is the honest boundary.
 */
export function isActive(member: Member | null): boolean {
  if (member === null) {
    return false;
  }
  if (member.status !== "active" && member.status !== "trialing") {
    return false;
  }
  return (
    member.current_period_end === null ||
    new Date(member.current_period_end).getTime() > Date.now()
  );
}

export async function getMemberByEmail(
  rawEmail: string,
): Promise<Member | null> {
  const rows = await sql`
    SELECT email, stripe_customer_id, status, current_period_end
    FROM members WHERE email = ${normaliseEmail(rawEmail)};
  `;
  return (rows[0] as Member | undefined) ?? null;
}

/** Whether an address has ever been a member, for the sign-in check. */
export async function memberExists(rawEmail: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM members WHERE email = ${normaliseEmail(rawEmail)} LIMIT 1;
  `;
  return rows.length > 0;
}

/**
 * Records what Stripe just told us.
 *
 * Idempotent, because webhooks arrive more than once and out of order: the
 * same event replayed writes the same row, and `ON CONFLICT` means a
 * `customer.subscription.updated` that overtakes the checkout completion
 * still lands. Keyed on email so a subscriber who checks out twice with the
 * same address updates one row rather than accumulating them.
 */
export async function upsertMember(input: {
  email: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  status: string;
  currentPeriodEnd: string | null;
}): Promise<void> {
  await sql`
    INSERT INTO members (email, stripe_customer_id, stripe_subscription_id,
                         status, current_period_end)
    VALUES (${normaliseEmail(input.email)}, ${input.stripeCustomerId},
            ${input.stripeSubscriptionId}, ${input.status},
            ${input.currentPeriodEnd})
    ON CONFLICT (email) DO UPDATE
      SET stripe_customer_id     = EXCLUDED.stripe_customer_id,
          stripe_subscription_id = EXCLUDED.stripe_subscription_id,
          status                 = EXCLUDED.status,
          current_period_end     = EXCLUDED.current_period_end;
  `;
}

/**
 * Updates by Stripe customer id, for events that carry no email.
 *
 * `customer.subscription.deleted` identifies the customer, not the person,
 * so a cancellation has to be matched on the id recorded at checkout.
 */
export async function updateMemberByCustomer(input: {
  stripeCustomerId: string;
  status: string;
  currentPeriodEnd: string | null;
}): Promise<void> {
  await sql`
    UPDATE members
       SET status = ${input.status},
           current_period_end = ${input.currentPeriodEnd}
     WHERE stripe_customer_id = ${input.stripeCustomerId};
  `;
}

/**
 * Counts a member's view of a photograph, for the day.
 *
 * Aggregate only. There is no row here that says who looked at what — just
 * how much attention each photograph drew from paying members, which is
 * what a revenue share would be divided by.
 */
export async function recordMemberView(photoId: string): Promise<void> {
  await sql`
    INSERT INTO photo_member_views (photo_id, day, views)
    VALUES (${photoId}, CURRENT_DATE, 1)
    ON CONFLICT (photo_id, day)
      DO UPDATE SET views = photo_member_views.views + 1;
  `;
}
