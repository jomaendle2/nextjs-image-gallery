"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import {
  sendSubscribeConfirmation,
  sendSubscribeWelcome,
} from "@/lib/auth/email";
import { clientIp, signInLimiter } from "@/lib/rate-limit";
import { siteOrigin } from "@/lib/site-url";
import {
  confirmSubscription,
  pruneUnconfirmed,
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

  /*
   * Everything below the response, for the reason `requestSignIn` does the
   * same: both branches already returned identical wording, but only one of
   * them awaited an HTTPS round trip to the mail provider. An address that
   * is already confirmed skipped the send and came back measurably sooner,
   * so a stopwatch on this form would answer the one question the neutral
   * wording exists to refuse — whether a given person reads this gallery.
   *
   * Errors are logged rather than surfaced, again matching sign-in: a mail
   * provider outage must not become a second way to tell a known address
   * from an unknown one.
   */
  after(async () => {
    try {
      /*
       * Clear out addresses that were typed and never confirmed.
       *
       * `pruneUnconfirmed` existed and nothing called it, so every abandoned
       * signup stayed forever — an address somebody entered and thought
       * better of, held indefinitely with a hashed token beside it. Double
       * opt-in is the promise that an unconfirmed address is not kept;
       * keeping it anyway makes the promise a formality.
       *
       * Here rather than on a schedule, matching how login tokens are
       * pruned: cheap housekeeping that only runs when somebody is
       * subscribing anyway.
       */
      await pruneUnconfirmed();

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
    }
  });

  return SENT;
}

/**
 * Redeems a confirmation token. Returns whether it worked, so the page can
 * say so — this one is not an oracle, because holding the token is already
 * proof of holding the inbox.
 */
/*
 * Not exported. Every export from a "use server" module is a callable
 * endpoint, so exporting a helper nothing imports publishes a second way to
 * confirm a subscription — one that skips the redirect the page relies on
 * and answers to anybody who can POST. It needs a valid token either way,
 * so this is surface rather than a hole, but surface with no caller is
 * surface with no reason.
 */
async function confirm(token: string): Promise<boolean> {
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

/**
 * Confirms a subscription, from a POST rather than a page load.
 *
 * The third instance of the same mistake: unsubscribe deleted on GET, the
 * magic link signed you in on GET, and this confirmed on GET. Mail gateways
 * fetch every URL in an inbound message, so all three were carried out by a
 * scanner before the recipient touched them.
 *
 * The harm here is subtler than the other two, and worse in one respect.
 * Nothing is destroyed — the person did ask to subscribe — but the record of
 * consent becomes a machine rather than a human, which is the entire point
 * of double opt-in and the basis the privacy policy claims. Meanwhile the
 * token is spent, so their real click lands on "that link didn't work",
 * reporting failure at the moment it actually succeeded.
 */
export async function confirmAction(formData: FormData): Promise<void> {
  const token = formData.get("token");
  const confirmed =
    typeof token === "string" && token !== "" ? await confirm(token) : false;

  redirect(`/subscribe/confirm?state=${confirmed ? "done" : "unknown"}`);
}
