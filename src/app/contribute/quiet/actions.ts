"use server";

import { redirect } from "next/navigation";
import { muteNudges } from "@/lib/auth/contributors";

/**
 * Stops the nudges, from a POST rather than a page load.
 *
 * The same rule as `unsubscribeAction`, for the same reason: the link goes
 * out in email, mail gateways fetch every URL in an inbound message, and a
 * GET that mutated would mute whole organisations before anybody read it.
 * The mutation therefore lives in a server action, which is a POST, and the
 * page the link opens is a single button.
 *
 * There is no confirmation step. Asking somebody to confirm that they meant
 * to stop being asked would be a dark pattern with a polite face — the click
 *is* the opt-out, not permission to perform one.
 */
export async function quietAction(formData: FormData): Promise<void> {
  const token = formData.get("token");
  const muted =
    typeof token === "string" && token !== "" ? await muteNudges(token) : false;

  /*
   * The token leaves the URL. Unlike an unsubscribe token this one is *not*
   * single-use — it is the same secret in every nudge, so it stays valid —
   * which makes leaving it in a browser history entry worse rather than
   * better.
   */
  redirect(`/contribute/quiet?state=${muted ? "quiet" : "unknown"}`);
}
