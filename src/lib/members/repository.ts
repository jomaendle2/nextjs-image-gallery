import { normaliseEmail } from "@/lib/auth/slug";
import { sql } from "@/lib/database";
import type { Member } from "./status";

export type { Member } from "./status";

/*
 * `isActive` and `hasLiveSubscription` live in `./status`, which imports no
 * database, so the rules deciding access and billing can be tested without a
 * connection string. Import them from there directly: re-exporting through
 * this module would drag Postgres into anything that only wanted to ask a
 * question about a status.
 */

/**
 * Membership, as Stripe reports it.
 *
 * Every write here comes from a verified webhook. Nothing in this module is
 * called from a success page or a redirect, because arriving at a URL is not
 * evidence of having paid — anyone can guess `?success=true`.
 */

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
 * Why a write did or did not happen.
 *
 * Three outcomes rather than a boolean, because two different refusals want
 * two different responses: a stale event is routine and should be ignored
 * quietly, while a customer mismatch means somebody checked out using an
 * address they may not control and deserves a log line.
 */
export type UpsertOutcome = "written" | "stale" | "wrong-customer";

export async function upsertMember(input: {
  email: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  status: string;
  currentPeriodEnd: string | null;
  /** When Stripe created the event, for the ordering guard. */
  eventAt: string;
}): Promise<UpsertOutcome> {
  const email = normaliseEmail(input.email);
  /*
   * A row belongs to the customer already in it.
   *
   * `DO UPDATE` used to overwrite `stripe_customer_id` unconditionally, and
   * once checkout accepted anonymous buyers that made the address on a
   * membership self-asserted: anybody could pay five euros, type somebody
   * else's address at Stripe, and have that person's row repointed at their
   * own Stripe customer. The victim's "Manage or cancel" button would then
   * open a portal session for the attacker's customer — their invoices,
   * their card, their subscription — and the attacker cancelling would write
   * `canceled` onto the victim's row and lock a paying member out.
   *
   * So the customer id is the thing that owns the row, and a second customer
   * arriving for the same address is refused rather than merged. `WHERE`
   * on a `DO UPDATE` turns the conflict into a no-op instead of an error, so
   * a replayed event still succeeds and Stripe is not made to retry.
   *
   * The access half was always safe and still is — a membership is only
   * usable through a link sent to the address — but writing was not, and
   * "you cannot use it" is no comfort to somebody whose own row was taken.
   *
   * Records what Stripe just told us, idempotently: the same event replayed
   * writes the same row, and keying on email means a subscriber who checks
   * out twice with the same address updates one row rather than
   * accumulating them.
   */

  /*
   * Two guards on one `DO UPDATE`, and both must be no-ops rather than
   * errors: raising here would return 500 and have Stripe redeliver the same
   * event for three days.
   *
   *   stripe_customer_id — the row belongs to the customer already in it.
   *   last_event_at      — a later event may not be undone by an earlier one.
   */
  const rows = await sql`
    INSERT INTO members (email, stripe_customer_id, stripe_subscription_id,
                         status, current_period_end, last_event_at)
    VALUES (${email}, ${input.stripeCustomerId},
            ${input.stripeSubscriptionId}, ${input.status},
            ${input.currentPeriodEnd}, ${input.eventAt})
    ON CONFLICT (email) DO UPDATE
      SET stripe_customer_id     = EXCLUDED.stripe_customer_id,
          stripe_subscription_id = EXCLUDED.stripe_subscription_id,
          status                 = EXCLUDED.status,
          current_period_end     = EXCLUDED.current_period_end,
          last_event_at          = EXCLUDED.last_event_at
      WHERE members.stripe_customer_id = EXCLUDED.stripe_customer_id
        AND (members.last_event_at IS NULL
             OR members.last_event_at <= EXCLUDED.last_event_at)
    RETURNING email;
  `;

  if (rows.length > 0) {
    return "written";
  }

  /*
   * Nothing was written, and which guard stopped it decides whether this is
   * worth anybody's attention. One extra read, only on the refusal path.
   */
  const existing = await getMemberByEmail(email);
  if (
    existing !== null &&
    existing.stripe_customer_id !== input.stripeCustomerId
  ) {
    console.error(
      `Refused to repoint the membership for ${email} at a different Stripe ` +
        "customer. Someone may have checked out using an address they do " +
        "not control, or a customer was recreated for an existing member.",
    );
    return "wrong-customer";
  }
  return "stale";
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
  /** When Stripe created the event, for the ordering guard. */
  eventAt: string;
}): Promise<void> {
  /*
   * Same monotonic guard as the upsert. This path handles events carrying no
   * address, which is where cancellations arrive — precisely the write a
   * retried older event must not be able to undo.
   */
  await sql`
    UPDATE members
       SET status = ${input.status},
           current_period_end = ${input.currentPeriodEnd},
           last_event_at = ${input.eventAt}
     WHERE stripe_customer_id = ${input.stripeCustomerId}
       AND (last_event_at IS NULL OR last_event_at <= ${input.eventAt});
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
