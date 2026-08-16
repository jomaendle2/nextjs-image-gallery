import {
  looksLikeEmail,
  normaliseEmail,
  normaliseSiteUrl,
} from "@/lib/auth/slug";

/**
 * Validation for the public application form, kept pure and free of any
 * database import so it can be tested without a connection.
 *
 * This is the one form on the site an unauthenticated stranger can post to,
 * so everything it accepts is bounded here rather than trusted downstream.
 */

const MAX_NAME = 80;
const MAX_NOTE = 200;
const MAX_URL = 300;

export interface ApplicationInput {
  email: string;
  display_name: string;
  site_url: string;
  note: string | null;
}

export type ApplicationResult =
  | { ok: true; value: ApplicationInput }
  | { ok: false; error: string };

/**
 * Photographers give their work as `instagram.com/name` as often as with a
 * scheme, and rejecting that is a pointless obstacle — so a bare host is
 * upgraded to https rather than refused.
 */

function field(form: FormData, name: string, max: number): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function validateApplication(form: FormData): ApplicationResult {
  /*
   * Honeypot. A field no human sees and every naive bot fills in. Reported
   * as success so the bot has nothing to learn from the response.
   */
  const trap = form.get("website");
  if (typeof trap === "string" && trap !== "") {
    return { ok: false, error: "SILENT_DROP" };
  }

  const displayName = field(form, "display_name", MAX_NAME);
  if (displayName === "") {
    return { ok: false, error: "Tell us your name." };
  }

  const email = normaliseEmail(field(form, "email", MAX_URL));
  if (!looksLikeEmail(email)) {
    return { ok: false, error: "That does not look like an email address." };
  }

  const siteUrl = normaliseSiteUrl(field(form, "site_url", MAX_URL));
  if (siteUrl === null) {
    return {
      ok: false,
      error: "Add a link to your work — a portfolio, or your Instagram.",
    };
  }

  const note = field(form, "note", MAX_NOTE);

  return {
    ok: true,
    value: {
      email,
      display_name: displayName,
      site_url: siteUrl,
      note: note === "" ? null : note,
    },
  };
}
