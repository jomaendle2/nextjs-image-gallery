export interface Member {
  email: string;
  stripe_customer_id: string;
  status: string;
  current_period_end: string | null;
}

/**
 * The two questions a membership status answers, kept apart from the
 * database that stores it.
 *
 * These decide who sees paid content and who may be charged again, and they
 * live here rather than in `repository.ts` so they can be tested without a
 * connection string. A rule about access should not need Postgres to be
 * running before anybody can check that it is right.
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

/**
 * Statuses where Stripe still considers the subscription live, and so a
 * second checkout would be a second bill.
 *
 * Wider than `isActive` on purpose, and the difference is the point.
 * `past_due` does not grant access — Stripe is still retrying the card, and
 * serving paid content through that window is a decision we declined to
 * make — but it very much still bills, so offering checkout again would
 * charge somebody twice for the same month the moment the retry cleared.
 * Access and billing are different questions and this codebase asks them
 * separately.
 */
/*
 * `incomplete` is deliberately absent, and it is the one that took thought.
 *
 * It looks like it belongs — Stripe considers the subscription to exist —
 * but it is the status where the *first* payment never cleared, so nothing
 * has been billed. Including it meant somebody whose card was declined at
 * checkout had no access and could not start another checkout either, until
 * Stripe expired the attempt about a day later. That is the worst possible
 * response to a failed payment: refusing the person's second attempt to give
 * you money.
 */
const LIVE_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  // Collection paused, subscription intact — resuming bills, so a second
  // checkout would be a second bill.
  "paused",
]);

/** Whether a new checkout would duplicate a subscription that already bills. */
export function hasLiveSubscription(member: Member | null): boolean {
  return member !== null && LIVE_STATUSES.has(member.status);
}
