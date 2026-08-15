"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  sendSubscribeConfirmation,
  sendSubscribeWelcome,
} from "@/lib/auth/email";
import { clientIp, signInLimiter } from "@/lib/rate-limit";
import { siteOrigin } from "@/lib/site-url";
import {
  confirmSubscription,
  requestSubscription,
  unsubscribe,
} from "@/lib/subscribers/repository";
import { validateSubscription } from "@/lib/subscribers/validate";

export interface SubscribeState {
  status: "idle" | "sent" | "error";
  message: string | null;
}

/*
 * A "use server" module may only export async functions, so the form's
 * initial state lives with the form. Type exports are erased and are fine.
 */
const SENT: SubscribeState = { status: "sent", message: null };

/**
 * Takes an address and sends it a confirmation, or appears to.
 *
 * Every path that is not a validation error answers identically. Whether an
 * address is already subscribed, was just rate-limited, or has this second
 * been mailed a link, the visitor sees the same sentence — because the
 * alternative is a form that will tell a stranger whether a given person
 * reads this gallery. The apply form settled the same question the same way.
 */
export async function subscribe(
  _previous: SubscribeState,
  formData: FormData,
): Promise<SubscribeState> {
  const result = validateSubscription(formData);

  if (!result.ok) {
    // A filled honeypot is told exactly what a person is told.
    if (result.error === "SILENT_DROP") {
      return SENT;
    }
    return { status: "error", message: result.error };
  }

  const headerList = await headers();
  if (
    !(
      signInLimiter.check(`sub:ip:${clientIp(headerList)}`) &&
      signInLimiter.check(`sub:em:${result.email}`)
    )
  ) {
    return SENT;
  }

  try {
    const pending = await requestSubscription(result.email);
    // Null means the address is already confirmed. Nothing to send, and
    // saying so would answer a question we do not answer.
    if (pending !== null) {
      await sendSubscribeConfirmation(
        result.email,
        `${siteOrigin()}/subscribe/confirm?token=${encodeURIComponent(pending.confirmSecret)}`,
      );
    }
  } catch (error) {
    console.error("Subscription request failed:", error);
    return {
      status: "error",
      message: "Something went wrong. Please try again in a moment.",
    };
  }

  return SENT;
}

/**
 * Redeems a confirmation token. Returns whether it worked, so the page can
 * say so — this one is not an oracle, because holding the token is already
 * proof of holding the inbox.
 */
export async function confirm(token: string): Promise<boolean> {
  const confirmed = await confirmSubscription(token);
  if (confirmed === null) {
    return false;
  }

  try {
    await sendSubscribeWelcome(
      confirmed.email,
      `${siteOrigin()}/subscribe/unsubscribe?token=${encodeURIComponent(confirmed.unsubscribeSecret)}`,
    );
  } catch (error) {
    /*
     * The subscription is already recorded, so a failed welcome is not a
     * failed confirmation and must not be reported as one. The unsubscribe
     * link will also reach them in the first real message.
     */
    console.error("Welcome email failed:", error);
  }

  return true;
}

/**
 * Removes an address, from a POST rather than a page load.
 *
 * The unsubscribe link goes out in email, and corporate link scanners —
 * SafeLinks, Proofpoint, Barracuda — fetch every URL in an inbound message
 * before the recipient sees it. A GET that deletes would therefore
 * unsubscribe whole organisations silently, on the first announcement, with
 * the token spent before anybody read the mail.
 *
 * Scanners issue GET and not POST, so moving the deletion here fixes that
 * without adding a confirmation step. It is still one click: the page the
 * link opens is a single button. Asking somebody to confirm that they meant
 * to leave would be a dark pattern with a polite face, and this is not that
 * — the click *is* the unsubscribe, not permission to perform it.
 */
export async function unsubscribeAction(formData: FormData): Promise<void> {
  const token = formData.get("token");
  const removed =
    typeof token === "string" && token !== ""
      ? await unsubscribe(token)
      : false;

  /*
   * The token leaves the URL either way. It is single-use and now spent, but
   * a browser history entry is not a place it needs to persist.
   */
  redirect(`/subscribe/unsubscribe?state=${removed ? "gone" : "unknown"}`);
}
