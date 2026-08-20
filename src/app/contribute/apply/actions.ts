"use server";

import { headers } from "next/headers";
import { submitApplication } from "@/lib/applications/repository";
import { validateApplication } from "@/lib/applications/validate";
import type { FormState } from "@/lib/form-state";
import { clientIp, signInLimiter } from "@/lib/rate-limit";

/** One shape for every form on the site. See `@/lib/form-state`. */
export type ApplyState = FormState;

/*
 * No value exports here beyond the actions themselves: a "use server" module
 * may only export async functions, so the form's initial state lives with the
 * form. Type exports are erased at compile time and are fine.
 */
const SENT: ApplyState = { tone: "sent", message: null };

export async function apply(
  _previous: ApplyState,
  formData: FormData,
): Promise<ApplyState> {
  const result = validateApplication(formData);

  if (!result.ok) {
    /*
     * A bot that filled the honeypot is told the same thing a person is, so
     * it learns nothing about why it failed and stops retrying.
     */
    if (result.error === "SILENT_DROP") {
      return SENT;
    }
    return { tone: "error", message: result.error };
  }

  const headerList = await headers();
  if (!signInLimiter.check(`apply:${clientIp(headerList)}`)) {
    return SENT;
  }

  try {
    await submitApplication(result.value);
  } catch (error) {
    console.error("Application failed:", error);
    return {
      tone: "error",
      message: "Something went wrong. Please try again in a moment.",
    };
  }

  return SENT;
}
