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
