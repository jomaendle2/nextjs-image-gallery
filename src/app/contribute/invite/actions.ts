"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { claimInvite } from "@/lib/auth/contributors";
import { sendInvitation } from "@/lib/auth/email";
import { readInviteForm } from "@/lib/auth/invite-form";
import { requireContributor } from "@/lib/auth/session";
import { invitationUrl } from "@/lib/auth/tokens";
import { type FormState, failed, succeeded } from "@/lib/form-state";
import { showcaseForMail } from "@/lib/photos/showcase";
import { clientIp, inviteLimiter } from "@/lib/rate-limit";
import { siteOrigin } from "@/lib/site-url";

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
    return failed("Too many invitations just now. Try again in a few minutes.");
  }

  const form = readInviteForm(formData, actor.email);
  if ("error" in form) {
    return failed(form.error);
  }

  const { email, displayName, siteUrl } = form;
  const outcome = await claimInvite({
    inviterId: actor.id,
    email,
    display_name: displayName,
    site_url: siteUrl,
  });

  if (outcome.status === "no-invites-left") {
    return failed("You have used all three of your invitations.");
  }
  if (outcome.status === "already-a-contributor") {
    return failed(`${email} is already a photographer here.`);
  }
  if (outcome.status === "inviter-not-eligible") {
    return failed("Your account cannot send invitations.");
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
    await sendInvitation(email, {
      displayName,
      invitedByName: actor.display_name,
      signInUrl: await invitationUrl(email),
      showcase: await showcaseForMail(),
    });
  } catch (error) {
    console.error("Invitation email failed:", error);
    return failed(
      `${displayName} can sign in at ${siteOrigin()}/contribute, but the email did not go out. Send them the link yourself.`,
    );
  }

  const left =
    outcome.remaining === 0
      ? "That was your last one."
      : `${outcome.remaining} left.`;
  return succeeded(`Invited ${email}. ${left}`);
}
