/**
 * Validation for the public subscribe form, kept pure and free of any
 * database import so it can be tested without a connection — the same shape
 * as `applications/validate.ts`, and for the same reason: this is a form an
 * unauthenticated stranger can post to.
 */

import { looksLikeEmail } from "@/lib/auth/slug";

export type SubscribeResult =
  | { ok: true; email: string }
  | { ok: false; error: "SILENT_DROP" | string };

export function validateSubscription(form: FormData): SubscribeResult {
  /*
   * The honeypot, named and positioned as the apply form's is. A bot that
   * fills every field it finds is told the same thing a person is, so it
   * learns nothing and stops retrying.
   */
  if (String(form.get("website") ?? "") !== "") {
    return { ok: false, error: "SILENT_DROP" };
  }

  const email = String(form.get("email") ?? "").trim();

  if (email === "") {
    return { ok: false, error: "Please enter your email address." };
  }
  if (!looksLikeEmail(email)) {
    return { ok: false, error: "That does not look like an email address." };
  }

  return { ok: true, email };
}
