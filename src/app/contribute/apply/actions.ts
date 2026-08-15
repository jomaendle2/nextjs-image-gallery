"use server";

import { headers } from "next/headers";
import { submitApplication } from "@/lib/applications/repository";
import { validateApplication } from "@/lib/applications/validate";
import { clientIp, signInLimiter } from "@/lib/rate-limit";

export interface ApplyState {
  status: "idle" | "sent" | "error";
  message: string | null;
}

/*
 * No value exports here beyond the actions themselves: a "use server" module
 * may only export async functions, so the form's initial state lives with the
 * form. Type exports are erased at compile time and are fine.
 */
const SENT: ApplyState = { status: "sent", message: null };

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
    return { status: "error", message: result.error };
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
      status: "error",
      message: "Something went wrong. Please try again in a moment.",
    };
  }

  return SENT;
}
