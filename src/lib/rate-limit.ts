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

/** Shared by the sign-in route: limited per IP and per email address. */
export const signInLimiter = createLimiter();
