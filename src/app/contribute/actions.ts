"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sendLoginEmail } from "@/lib/auth/email";
import { createSession, destroySession } from "@/lib/auth/session";
import { normaliseEmail } from "@/lib/auth/slug";
import {
  consumeLoginToken,
  mintLoginToken,
  pruneLoginTokens,
} from "@/lib/auth/tokens";
import { clientIp, signInLimiter } from "@/lib/rate-limit";
import { siteOrigin } from "@/lib/site-url";

export interface SignInState {
  message: string | null;
}

/**
 * Always reports the same thing.
 *
 * Unknown address, revoked contributor, rate-limited, provider outage — the
 * visitor sees "Check your inbox" in every case. Any branch that said
 * otherwise would turn this form into a test for who has been invited.
 */
const NEUTRAL = "If that address is on the list, a sign-in link is on its way.";

export async function requestSignIn(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const raw = formData.get("email");
  if (typeof raw !== "string" || !raw.includes("@")) {
    return { message: "That does not look like an email address." };
  }

  const email = normaliseEmail(raw);
  const headerList = await headers();
  const ip = clientIp(headerList);

  // Limited on both axes: per address so one inbox cannot be flooded, and
  // per IP so one client cannot walk a list of addresses.
  if (
    !(signInLimiter.check(`ip:${ip}`) && signInLimiter.check(`em:${email}`))
  ) {
    return { message: NEUTRAL };
  }

  try {
    const secret = await mintLoginToken(email);
    if (secret !== null) {
      const url = `${siteOrigin()}/contribute/verify?token=${secret}`;
      await sendLoginEmail(email, url);
    }
  } catch (error) {
    console.error("Sign-in request failed:", error);
  }

  return { message: NEUTRAL };
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
   * dashboard — it would refuse them the moment they arrived. A member is
   * sent to the gallery, which is what they signed in to see.
   */
  redirect(redeemed.contributor === null ? "/" : "/contribute/photos");
}
