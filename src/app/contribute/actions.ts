"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sendLoginEmail } from "@/lib/auth/email";
import { destroySession } from "@/lib/auth/session";
import { normaliseEmail } from "@/lib/auth/slug";
import { mintLoginToken } from "@/lib/auth/tokens";
import { signInLimiter } from "@/lib/rate-limit";

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

function siteUrl(host: string): string {
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

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
  const ip = headerList.get("x-forwarded-for") ?? "unknown";

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
      const host = headerList.get("host") ?? "localhost:3000";
      const url = `${siteUrl(host)}/contribute/verify?token=${secret}`;
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
