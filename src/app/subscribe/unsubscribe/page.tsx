import type { Metadata } from "next";
import { StatusPage } from "@/components/StatusPage";
import { unsubscribe } from "@/lib/subscribers/repository";

export const metadata: Metadata = {
  title: "Unsubscribed — the beauty of earth.",
  robots: { index: false },
};

/**
 * One click, no confirmation step, no sign-in.
 *
 * Asking somebody to confirm that they meant to leave is a dark pattern with
 * a polite face. The token is unguessable and does nothing except this, so
 * the worst a stray click can cost is a re-subscription that takes one
 * field.
 *
 * Unsubscribing deletes the row. Keeping an address after its owner asked to
 * be forgotten is the opposite of what they asked for.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const removed = token === undefined ? false : await unsubscribe(token);

  return removed ? (
    <StatusPage
      detail="Your address has been deleted, not just flagged. Nothing further will be sent to it."
      title="Unsubscribed"
    />
  ) : (
    <StatusPage
      detail="That link did not match a subscription — it may already have been used, in which case nothing is being sent to you anyway."
      title="Nothing to unsubscribe"
    />
  );
}
