"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { FormState } from "@/app/form-state";
import { claimInvite } from "@/lib/auth/contributors";
import { sendInvitation } from "@/lib/auth/email";
import { requireContributor } from "@/lib/auth/session";
import {
  looksLikeEmail,
  normaliseEmail,
  normaliseSiteUrl,
} from "@/lib/auth/slug";
import { clientIp, inviteLimiter } from "@/lib/rate-limit";

/** Matches the owner's invite form, which slices names to the same length. */
const MAX_NAME = 80;

function refuse(message: string): FormState {
  return { message, tone: "error" };
}

type ReadInvite =
  | { email: string; displayName: string; siteUrl: string | null }
  | { error: string };

/**
 * The form, checked. Separate from the action so the action reads as the
 * sequence it is — who, how often, then what — rather than as validation
 * with a claim buried in the middle.
 */
function readInvite(formData: FormData, actorEmail: string): ReadInvite {
  const email = normaliseEmail(String(formData.get("email") ?? ""));
  const displayName = String(formData.get("display_name") ?? "")
    .trim()
    .slice(0, MAX_NAME);
  const siteUrlRaw = String(formData.get("site_url") ?? "").trim();

  if (!looksLikeEmail(email) || displayName === "") {
    return { error: "An email address and a name are required." };
  }

  /*
   * Said plainly rather than left to the generic answer.
   *
   * The claim would refuse this anyway — the inviter is a contributor, so
   * their own address fails its "already a contributor" guard and costs no
   * quota. But "that address is already a photographer here" is a confusing
   * thing to be told about yourself, and this check is race-free by
   * construction: the address comes from the session, not a database read.
   */
  if (email === normaliseEmail(actorEmail)) {
    return { error: "That is your own address." };
  }

  if (siteUrlRaw === "") {
    return { email, displayName, siteUrl: null };
  }
  const siteUrl = normaliseSiteUrl(siteUrlRaw);
  if (siteUrl === null) {
    return { error: "That website address does not look like a URL." };
  }
  return { email, displayName, siteUrl };
}

/**
 * A contributor spending one of their three invites.
 *
 * In its own file rather than beside the owner's `invite()` for two reasons,
 * one of them a rule this repository enforces on itself:
 *
 *   - `security-interface.test.ts` asserts that every action in
 *     `admin/actions.ts` calls `requireOwner()` in its first lines. This one
 *     deliberately does not, and adding it there would either break that
 *     test or invite somebody to weaken it.
 *   - `security.test.ts` requires any `actions.ts` that sends mail to carry
 *     a limiter or `requireOwner()`. Putting this in `contribute/actions.ts`
 *     would have satisfied that rule for free, because a limiter is already
 *     in that file — which is exactly the wrong reason to pass. Its own file
 *     means its own limiter.
 *
 * The limiter is not the real control; three invites in the database is. It
 * is here so a loop cannot hammer the mail provider inside one window, and
 * it is keyed on the actor as well as the address because the caller is
 * signed in — the same two-key shape the sign-in form uses.
 */
export async function inviteAsContributor(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireContributor();

  const headerList = await headers();
  if (
    !(
      inviteLimiter.check(`ip:${clientIp(headerList)}`) &&
      inviteLimiter.check(`actor:${actor.id}`)
    )
  ) {
    return refuse("Too many invitations just now. Try again in a few minutes.");
  }

  const form = readInvite(formData, actor.email);
  if ("error" in form) {
    return refuse(form.error);
  }

  const { email, displayName, siteUrl } = form;
  const outcome = await claimInvite({
    inviterId: actor.id,
    email,
    display_name: displayName,
    site_url: siteUrl,
  });

  if (outcome.status === "no-invites-left") {
    return refuse("You have used all three of your invitations.");
  }
  if (outcome.status === "already-a-contributor") {
    return refuse(`${email} is already a photographer here.`);
  }
  if (outcome.status === "inviter-not-eligible") {
    return refuse("Your account cannot send invitations.");
  }

  revalidatePath("/contribute/invite");
  revalidatePath("/contribute/photos");

  /*
   * The account exists whether or not the message lands, so a send failure
   * is reported as what it is rather than swallowed or thrown: the person
   * has access and simply has not been told. Same handling as the owner's
   * invite, for the same reason.
   */
  try {
    await sendInvitation(email, displayName, actor.display_name);
  } catch (error) {
    console.error("Invitation email failed:", error);
    return {
      message: `${displayName} can sign in at /contribute, but the email did not go out. Send them the link yourself.`,
      tone: "error",
    };
  }

  const left =
    outcome.remaining === 0
      ? "That was your last one."
      : `${outcome.remaining} left.`;
  return {
    message: `Invited ${email}. ${left}`,
    tone: "success",
  };
}
