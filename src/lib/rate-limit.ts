/**
 * A small fixed-window limiter held in process memory.
 *
 * Honest about what it is: under Fluid Compute each instance keeps its own
 * counters, so this is not a distributed limit. It is not the security
 * boundary either — single-use, short-lived, hashed tokens are. What it buys
 * is that nobody can cheaply enumerate the invite list or use the sign-in
 * form to mail-bomb an address, which is all it is here to do.
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

interface Window {
  count: number;
  resetAt: number;
}

export interface Limiter {
  check: (key: string, now?: number) => boolean;
}

export function createLimiter(
  maxAttempts: number = MAX_ATTEMPTS,
  windowMs: number = WINDOW_MS,
): Limiter {
  const windows = new Map<string, Window>();

  return {
    /** True if the attempt is allowed. Counts the attempt when it is. */
    check(key: string, now: number = Date.now()): boolean {
      const existing = windows.get(key);

      if (!existing || now >= existing.resetAt) {
        windows.set(key, { count: 1, resetAt: now + windowMs });
        // Expired entries for other keys would otherwise accumulate for the
        // lifetime of the instance.
        for (const [otherKey, window] of windows) {
          if (now >= window.resetAt) {
            windows.delete(otherKey);
          }
        }
        return true;
      }

      if (existing.count >= maxAttempts) {
        return false;
      }

      existing.count += 1;
      return true;
    },
  };
}

/**
 * The client IP, as far as it can be trusted.
 *
 * `x-forwarded-for` is a comma-separated chain a caller can prepend to, so
 * using the raw header as a bucket key would let one client mint a fresh
 * bucket per request. Vercel sets `x-real-ip` to the true client address; the
 * leftmost forwarded entry is the fallback.
 */
export function clientIp(headerList: Headers): string {
  const realIp = headerList.get("x-real-ip");
  if (realIp !== null && realIp !== "") {
    return realIp;
  }
  return (
    (headerList.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown"
  );
}

/** Shared by the sign-in and apply routes: limited per IP and per address. */
export const signInLimiter = createLimiter();

/**
 * For the two routes that reach into Stripe.
 *
 * Neither is a security boundary — checkout mints a link that grants
 * nothing, and the portal is session-gated and scoped to the caller's own
 * customer. What this stops is cost: every call to either creates a live
 * object in a metered third-party account, and checkout needs no session at
 * all, so without a limit anybody with a loop can fill the Stripe dashboard
 * with abandoned sessions.
 *
 * More generous than the sign-in window because a genuine person may
 * reasonably open checkout several times — card declined, wrong address,
 * changed their mind — and being told to come back in fifteen minutes at
 * the moment you are trying to pay is its own kind of failure.
 */
export const stripeLimiter = createLimiter(15);

/**
 * The member-only half of a photograph.
 *
 * This route had no limiter, and for as long as it returned only prose that
 * was defensible: two sentences per photograph are awkward to scrape and
 * close to worthless in bulk. An exact coordinate is neither. One member
 * with a loop could pull every marked point on the site in seconds and
 * republish the set, which is the difference between a paid feature and a
 * dataset — and the photographs most worth protecting are exactly the ones
 * somebody would want the set for.
 *
 * Keyed by member rather than by IP, because the gate upstream is a
 * membership: an anonymous caller never reaches this, and a member behind a
 * shared address should not be limited by their neighbours.
 *
 * 120 in fifteen minutes. A person browsing a gallery of fourteen
 * photographs, or three hundred, never comes close; a sweep of the whole
 * site does immediately. Generous on purpose — being told to come back later
 * while reading something you paid for is its own kind of failure.
 */
export const memberDetailsLimiter = createLimiter(120);

/**
 * Contributor invites.
 *
 * Five per window, matching sign-in rather than the more generous Stripe
 * allowance: nobody legitimately invites five photographers in a quarter of
 * an hour, and each one sends mail from this domain.
 *
 * Note this limiter is not the real control — a contributor only ever has
 * three invites, enforced in the database. This is here to stop a loop
 * hammering the mail provider inside one window, and because a contributor
 * account is a smaller thing to compromise than the owner's.
 */
export const inviteLimiter = createLimiter();
