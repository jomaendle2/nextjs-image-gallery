/**
 * The one Blob store this site will fetch from, and the check that enforces it.
 *
 * `next.config.ts` already pins exactly this hostname for the image
 * optimizer, and its comment explains why in full: the wildcard it replaced
 * matched *any* store on the platform, and anybody can create one for free —
 * which turns our optimizer into a public one, fetched and cached for a year
 * on our bill.
 *
 * That reasoning applies to every server-side fetch of a client-supplied URL,
 * and two other places were deriving their own weaker version of it:
 *
 * - `/api/photos/draft` matched on the *suffix*, so any store on the platform
 *   passed. A contributor could point a published row at a bucket they
 *   control and change what it serves afterwards.
 * - `/api/og` checked only that the URL began with `https://`, and Satori
 *   fetches every one of them server-side while rendering the card. That is
 *   an unauthenticated image proxy with our IP and our egress behind it, and
 *   the result was cached at the CDN for a day.
 *
 * One definition, imported by both, so widening it is a single deliberate
 * edit rather than three independent ones that drift. Keep it in step with
 * `next.config.ts` — there is no way to import that file from application
 * code, which is precisely why this module says so out loud.
 */

export const BLOB_HOST = "hqthnmomxieqm6os.public.blob.vercel-storage.com";

/** Photographs live under one prefix; nothing else is fetchable. */
const PHOTO_PREFIX = "/photos/";

/**
 * Whether a URL points at a photograph in our own store.
 *
 * Parsed rather than string-matched. `startsWith` and `endsWith` on a raw URL
 * are the two mistakes this replaces: `https://evil.example/?x=…blob-host` has
 * the right suffix somewhere in it, and only `new URL()` knows where the
 * hostname actually ends.
 */
export function isOurBlob(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return (
    parsed.protocol === "https:" &&
    parsed.hostname === BLOB_HOST &&
    parsed.pathname.startsWith(PHOTO_PREFIX)
  );
}
