import { formText } from "@/app/form-state";
import { MAX_URL } from "@/lib/applications/validate";
import { looksLikeEmail, normaliseEmail } from "@/lib/auth/slug";
import { type EarlyAccessTier, isEarlyAccessTier } from "./tiers";

/**
 * Validation for the early-access form, kept pure and free of any database
 * import so it can be tested without a connection — the same shape as
 * `subscribers/validate.ts` and `applications/validate.ts`, and for the same
 * reason: this is a form an unauthenticated stranger can post to.
 */

/** Room to say what the screens are for, and no room to write an essay. */
const MAX_NOTE = 500;

/**
 * The largest screen count that is a number rather than a mash of the
 * keyboard. A chain with more displays than this is a conversation, not a
 * form, and the note field is where they will say so.
 */
const MAX_SCREENS = 500;

export interface EarlyAccessInput {
  email: string;
  tier: EarlyAccessTier;
  note: string;
  /** Only ever meaningful for Spaces; null everywhere else. */
  screens: number | null;
}

export type EarlyAccessResult =
  | { ok: true; value: EarlyAccessInput }
  | { ok: false; error: string };

/**
 * How many screens, when a number was typed at all.
 *
 * Returns `undefined` for "they typed something that is not a count", which
 * the caller turns into a sentence — distinct from `null`, which is "they
 * left it blank", and is allowed. Blank has to stay allowed: the field is
 * optional by design, and somebody who has not decided how many screens they
 * want is exactly the person this page is trying to hear from.
 *
 * `Number()` rather than `parseInt`, because `parseInt("6 screens")` is 6 and
 * `parseInt("6.5")` is 6. Both are the form quietly deciding what somebody
 * meant, and this one is a number that will be read back to them later.
 */
function readScreens(raw: string): number | null | undefined {
  if (raw === "") {
    return null;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > MAX_SCREENS) {
    return undefined;
  }
  return value;
}

export function validateEarlyAccess(form: FormData): EarlyAccessResult {
  /*
   * The honeypot, named and positioned as the other two public forms' are. A
   * bot that fills every field it finds is told the same thing a person is,
   * so it learns nothing and stops retrying.
   */
  if (String(form.get("website") ?? "") !== "") {
    return { ok: false, error: "SILENT_DROP" };
  }

  const email = formText(form, "email", MAX_URL);
  if (email === "") {
    return { ok: false, error: "Please enter your email address." };
  }
  if (!looksLikeEmail(email)) {
    return { ok: false, error: "That does not look like an email address." };
  }

  /*
   * The tier comes from a hidden input, so a bad one is a crafted request
   * rather than a typo — and it is still a sentence rather than a throw. The
   * check itself is the load-bearing part: `tier` is written to a column that
   * decides which register somebody is counted in, and an unrecognised value
   * would sit there being counted as nothing.
   */
  const tier = formText(form, "tier", 40);
  if (!isEarlyAccessTier(tier)) {
    return { ok: false, error: "Pick one of the two to hear about." };
  }

  const screens = readScreens(formText(form, "screens", 10));
  if (screens === undefined) {
    return {
      ok: false,
      error: `Screens should be a whole number between 1 and ${MAX_SCREENS}.`,
    };
  }

  return {
    ok: true,
    value: {
      email: normaliseEmail(email),
      tier,
      note: formText(form, "note", MAX_NOTE),
      /*
       * A screen count against Pro is a field filled in on the wrong form —
       * the input is only rendered under Spaces — so it is dropped rather
       * than stored. The column means "displays in a building"; letting a
       * crafted POST put a number in it for the other tier would make the
       * one figure worth sorting by untrustworthy.
       */
      screens: tier === "spaces" ? screens : null,
    },
  };
}
