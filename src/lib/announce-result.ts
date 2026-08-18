import { count } from "./plural";

/** What `announceNewWork` reports back. */
export interface AnnounceOutcome {
  photographs: number;
  sent: number;
  failed: number;
}

/**
 * The sentence the owner reads after pressing send.
 *
 * Pulled out of the component so it can be tested without rendering
 * anything. It is the only report of an action that cannot be undone and
 * cannot be repeated, so its two jobs are to be accurate about partial
 * failure and to say where to look — a bare "sent" after some of the list
 * bounced would be a lie by omission at the one moment it matters.
 */
export function describeAnnouncement(outcome: AnnounceOutcome): string {
  const photographs = count(outcome.photographs, "photograph");
  const people = count(outcome.sent, "subscriber");

  if (outcome.failed === 0) {
    return `Sent ${photographs} to ${people}.`;
  }
  return `Sent ${photographs} to ${people}; ${outcome.failed} did not go out. They stay on the list, so the next announcement will reach them.`;
}
