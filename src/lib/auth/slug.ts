/**
 * Pure string helpers, deliberately free of any database import.
 * `src/lib/database.ts` throws at module load when DATABASE_URL is absent, so
 * anything that imports it drags a live connection into every consumer —
 * including unit tests that only want to check a slug.
 */

const MAX_SLUG_LENGTH = 48;

/**
 * A URL-safe handle derived from a display name. Diacritics are decomposed
 * first so "Mändle" becomes "mandle" rather than losing the letter entirely.
 */
export function slugify(displayName: string): string {
  const base = displayName
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
  return base === "" ? "contributor" : base;
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** RFC 5321's limit on a whole address. */
const MAX_EMAIL = 254;

/**
 * Deliberately loose. An address is either deliverable or it is not, and no
 * regex settles that — every door here sends a confirmation, and that is the
 * real check. What is worth rejecting is what is obviously not an address at
 * all, so a typo produces a message rather than a row and a send.
 */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The one rule, for every door.
 *
 * There were four: `includes("@")` at sign-in and at invite,
 * `includes("@")` plus start/end checks at apply, and this regex plus the
 * length cap at subscribe. So the site accepted different sets of addresses
 * depending on which form you typed into — `a@` was refused by apply and
 * accepted by sign-in, and only subscribe bounded the length at all.
 *
 * Nothing about "is this an address" varies by door, so nothing about the
 * rule should. It lives here, beside `normaliseEmail`, because this module
 * is the shared database-free home every one of those call sites already
 * imports from.
 */
export function looksLikeEmail(value: string): boolean {
  const email = value.trim();
  return email.length <= MAX_EMAIL && LOOKS_LIKE_EMAIL.test(email);
}

const MAX_URL = 300;
const HAS_SCHEME = /^https?:\/\//i;

/**
 * A photographer's own site, normalised — or null if it is not one.
 *
 * Same story as `looksLikeEmail`: one field, two doors, two rules. Someone
 * applying could type `annaweber.com` and have it upgraded to https; the
 * owner typing the identical string into the invite form was told it did not
 * look like a URL, because that form hand-rolled `new URL` with no bare-host
 * upgrade, no dot check and no length bound. The value is the same value
 * whichever door it comes through.
 */
export function normaliseSiteUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed.length > MAX_URL) {
    return null;
  }

  const withScheme = HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return null;
  }
  // A hostname with no dot is a typo or an intranet name, not a portfolio.
  if (!url.hostname.includes(".")) {
    return null;
  }

  return url.toString();
}

/**
 * Two photographers can share a name, so the slug gets a numeric suffix. One
 * query fetches every slug already claimed on this stem rather than probing
 * `-2`, `-3`, `-4` in a loop of round trips.
 */
export function pickFreeSlug(base: string, taken: readonly string[]): string {
  const claimed = new Set(taken);
  if (!claimed.has(base)) {
    return base;
  }
  let suffix = 2;
  while (claimed.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}
