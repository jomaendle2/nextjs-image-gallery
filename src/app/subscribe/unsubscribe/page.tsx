import type { Metadata } from "next";
import { unsubscribeAction } from "@/app/subscribe/actions";
import { StatusPage } from "@/components/StatusPage";
import { GlassButton } from "@/components/ui/glass-button";

export const metadata: Metadata = {
  title: "Stop following — the beauty of earth.",
  robots: { index: false },
};

/**
 * One click, no sign-in — but a click, not a page load.
 *
 * This page used to delete the row while rendering the GET. That is one
 * click fewer and quietly catastrophic: corporate link scanners fetch every
 * URL in an inbound message before the recipient sees it, so the first
 * announcement sent to anybody behind SafeLinks or Proofpoint would have
 * unsubscribed them automatically, with the token spent and no way back.
 *
 * Deleting from a POST fixes that, because scanners do not POST. What it
 * deliberately does not add is a confirmation step — asking somebody to
 * confirm that they meant to leave is a dark pattern with a polite face.
 * The button on this page is the unsubscribe itself.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; state?: string }>;
}) {
  const { token, state } = await searchParams;

  if (state === "gone") {
    return (
      <StatusPage
        detail="Your address has been deleted, not just flagged. Nothing further will be sent to it."
        title="No longer following"
      />
    );
  }

  if (state === "unknown" || token === undefined || token === "") {
    return (
      <StatusPage
        detail="That link did not match a subscription — it may already have been used, in which case nothing is being sent to you anyway."
        title="Nothing to stop"
      />
    );
  }

  return (
    <StatusPage
      action={
        <form action={unsubscribeAction}>
          <input name="token" type="hidden" value={token} />
          <GlassButton type="submit">Stop following</GlassButton>
        </form>
      }
      detail="One click and your address is deleted rather than flagged. You will not be asked to confirm twice, and you can follow again any time with one field."
      title="Stop following?"
    />
  );
}
