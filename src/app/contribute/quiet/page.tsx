import type { Metadata } from "next";
import { quietAction } from "@/app/contribute/quiet/actions";
import { StatusPage } from "@/components/StatusPage";
import { GlassButton } from "@/components/ui/glass-button";

export const metadata: Metadata = {
  title: "No more reminders — the beauty of earth.",
  robots: { index: false },
};

/**
 * The human half of the opt-out, mirroring `/subscribe/unsubscribe`.
 *
 * One click, no sign-in — but a click, not a page load. Corporate link
 * scanners fetch every URL in an inbound message before the recipient sees
 * it, so muting while rendering the GET would silence anybody behind
 * SafeLinks or Proofpoint automatically, and they would never learn why the
 * gallery stopped writing. Scanners do not POST; the button below is the
 * opt-out itself, and there is no second confirmation.
 *
 * What it stops is narrow, and the page says so: reminders, and nothing
 * else. Somebody tired of being asked to upload has not asked to be locked
 * out of their own account, so sign-in links keep working and the gallery's
 * announcements — which were separately consented to — keep arriving.
 */
export default async function QuietPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; state?: string }>;
}) {
  const { token, state } = await searchParams;

  if (state === "quiet") {
    return (
      <StatusPage
        detail="No more reminders to this address. Your sign-in link still works and your page is still yours — publish whenever you like."
        title="That is the last of them"
        tone="done"
      />
    );
  }

  if (state === "unknown" || token === undefined || token === "") {
    return (
      <StatusPage
        detail="That link did not match anybody. If it came from a reminder, the reminders have most likely already stopped."
        title="Nothing to stop"
        tone="nothing-to-do"
      />
    );
  }

  return (
    <StatusPage
      action={
        <form action={quietAction}>
          <input name="token" type="hidden" value={token} />
          <GlassButton type="submit">Stop the reminders</GlassButton>
        </form>
      }
      detail="One click and we stop reminding you to publish. Sign-in links and the gallery's own announcements are unaffected — different mail, different consent."
      title="No more reminders?"
    />
  );
}
