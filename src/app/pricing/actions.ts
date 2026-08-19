"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import type { FormState } from "@/app/form-state";
import { clientIp, signInLimiter } from "@/lib/rate-limit";
import { recordEarlyAccess } from "@/lib/waitlist/repository";
import { validateEarlyAccess } from "@/lib/waitlist/validate";

/** One shape for every form on the site. See `@/app/form-state`. */
export type EarlyAccessState = FormState;

/*
 * A "use server" module may only export async functions, so the form's
 * terminal state lives with the action. Type exports are erased and are fine.
 */
const SENT: EarlyAccessState = { tone: "sent", message: null };

/**
 * Files a request to hear about a tier that is not built yet.
 *
 * Every path that is not a validation error answers identically — already
 * registered, rate-limited, or filed this second all produce the same
 * sentence. The subscribe form settled this question the same way and for
 * the same reason: the alternative is a form that will tell a stranger
 * whether a given person is interested in a product, which for the Spaces
 * tier means telling them which businesses are shopping.
 *
 * No confirmation email, deliberately. Double opt-in exists to prove consent
 * before *sending* somebody things, and nothing here will send them anything
 * — this address is written down so that a person can write back to it once,
 * about the thing they just asked about. Adding a template to prove consent
 * for a message we are not going to send would be ceremony, and the register
 * is read on `/contribute/admin` rather than out of an inbox.
 */
export async function requestEarlyAccess(
  _previous: EarlyAccessState,
  formData: FormData,
): Promise<EarlyAccessState> {
  const result = validateEarlyAccess(formData);

  if (!result.ok) {
    // A filled honeypot is told exactly what a person is told.
    if (result.error === "SILENT_DROP") {
      return SENT;
    }
    return { tone: "error", message: result.error };
  }

  const headerList = await headers();
  if (
    !(
      signInLimiter.check(`wait:ip:${clientIp(headerList)}`) &&
      signInLimiter.check(`wait:em:${result.value.email}`)
    )
  ) {
    return SENT;
  }

  /*
   * Below the response, matching `subscribe`. There is no mail round trip to
   * hide here, but the timing argument survives without one: an address
   * already in the register takes the `DO UPDATE` branch and an unknown one
   * takes the insert, and a stopwatch on two database paths is still a
   * stopwatch on the question the neutral wording exists to refuse.
   *
   * The error is logged rather than surfaced, again matching sign-in — a
   * database blip must not become a second way to tell a known address from
   * an unknown one. The cost of that choice is real and worth naming: a lost
   * request is a person who believes they are on a list and is not.
   */
  after(async () => {
    try {
      await recordEarlyAccess(result.value);
    } catch (error) {
      console.error("Early access request failed:", error);
    }
  });

  return SENT;
}
