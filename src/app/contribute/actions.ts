"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { sendLoginEmail } from "@/lib/auth/email";
import { createSession, destroySession } from "@/lib/auth/session";
import { looksLikeEmail, normaliseEmail } from "@/lib/auth/slug";
import {
  consumeLoginToken,
  mintLoginToken,
  pruneLoginTokens,
} from "@/lib/auth/tokens";
import { type FormState, failed, sent } from "@/lib/form-state";
import { clientIp, signInLimiter } from "@/lib/rate-limit";
import { siteOrigin } from "@/lib/site-url";

/** One shape for every form on the site. See `@/lib/form-state`. */
export type SignInState = FormState;

/*
 * `NEUTRAL` used to live here, holding the one sentence every branch returned.
 *
 * The neutrality is unchanged and still the point: an unknown address, a
 * revoked contributor and a provider outage all reach the same terminal state,
 * because any branch that said otherwise would turn this form into a test for
 * who has been invited. What moved is where the words live — the form now
 * renders a confirmation panel rather than a line of grey text, so the
 * hedged sentence belongs there with the rest of what a person needs to know.
 *
 * The one branch that no longer hides is the throttle, and that is argued
 * where it happens.
 */

export async function requestSignIn(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const raw = formData.get("email");
  if (typeof raw !== "string" || !looksLikeEmail(raw)) {
    return failed("That does not look like an email address.");
  }

  const email = normaliseEmail(raw);
  const headerList = await headers();
  const ip = clientIp(headerList);

  /*
   * Limited on both axes: per address so one inbox cannot be flooded, and per
   * IP so one client cannot walk a list of addresses.
   *
   * **Being throttled now says so.** It used to return `NEUTRAL` — the same
   * "a link is on its way" as a success — while sending nothing, so somebody
   * who pressed the button a few times in frustration was told several more
   * times that a link was coming and then waited for mail that would never
   * arrive. Anti-enumeration does not require lying about our own throttle:
   * the limiter counts attempts whether or not the address exists, so saying
   * "too many, wait" reveals the caller's own rate and nothing about the
   * list. The peer-invite path has always worded it this way.
   */
  if (
    !(signInLimiter.check(`ip:${ip}`) && signInLimiter.check(`em:${email}`))
  ) {
    return failed("Too many requests just now. Try again in a few minutes.");
  }

  /*
   * The send happens after the response, and that is a security property
   * rather than a performance one.
   *
   * Both branches already returned the same words — the whole point of
   * `NEUTRAL` — but they did not take the same time. An unknown address did
   * two SELECTs and returned; a known one additionally did an INSERT and an
   * **awaited HTTPS round trip to the mail provider**, which is hundreds of
   * milliseconds anybody can measure. Identical wording with a measurable
   * delay is not a neutral response, it is a slower oracle: the form would
   * happily tell a stopwatch who is on the invite list.
   *
   * `after` moves the expensive, branch-revealing half past the response, so
   * what a caller can observe is the same either way. Errors are logged
   * rather than surfaced for the same reason they always were — a provider
   * outage must not become a way to distinguish a real address from a
   * fictional one.
   */
  after(async () => {
    try {
      const secret = await mintLoginToken(email);
      if (secret !== null) {
        const url = `${siteOrigin()}/contribute/verify?token=${secret}`;
        await sendLoginEmail(email, url);
      }
    } catch (error) {
      console.error("Sign-in request failed:", error);
    }
  });

  /*
   * The address goes back to the form so the confirmation can name it, and
   * so "send another" needs no retyping. It is the address the person just
   * typed, so echoing it tells them nothing they did not supply.
   */
  return sent(email);
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/contribute");
}

/**
 * Completes a sign-in, from a POST rather than a link click.
 *
 * The magic link used to be a GET that consumed the token as the page
 * loaded. Anything that follows links in the mail path — Outlook SafeLinks,
 * Proofpoint, Barracuda, an over-eager preview pane — therefore spent the
 * token before the recipient touched it, and the genuine click landed on
 * "that link has expired", indistinguishable from a stale one. Nobody
 * behind a corporate mail gateway could reliably sign in at all.
 *
 * Requiring a POST fixes that, because scanners do not POST. It costs one
 * button press, which is the price of the link working. It also removes a
 * smaller problem: a bare GET establishing a session meant a third party
 * could force somebody's browser to sign in as them by feeding them a URL.
 */
export async function completeSignIn(formData: FormData): Promise<void> {
  const token = formData.get("token");
  const redeemed =
    typeof token === "string" && token !== ""
      ? await consumeLoginToken(token)
      : null;

  if (!redeemed) {
    redirect("/contribute?error=expired");
  }

  await createSession(redeemed.email, redeemed.contributor?.id ?? null);

  // Cheap housekeeping on a path that runs rarely, rather than a cron job.
  await pruneLoginTokens();

  /*
   * Somebody with no contributors row has nothing to do on the contributor
   * dashboard — it would refuse them the moment they arrived.
   *
   * They go to `/membership` rather than the gallery, because the gallery
   * looks exactly the same signed in as signed out. A member who had just
   * proved they own the address landed on a page with no acknowledgement of
   * it, and somebody whose card is failing landed on the non-member
   * experience with no explanation. `/membership` can say which of those is
   * true.
   */
  redirect(
    redeemed.contributor === null ? "/membership" : "/contribute/photos",
  );
}
