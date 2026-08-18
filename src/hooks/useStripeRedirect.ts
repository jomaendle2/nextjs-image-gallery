"use client";

import { useCallback, useState } from "react";

interface StripeRedirect {
  /** Ask the server for a URL, then go there. */
  go: () => void;
  busy: boolean;
  error: string | null;
}

/**
 * Ask one of our Stripe routes for a hosted URL and follow it.
 *
 * Both places this site touches Stripe — buying a membership and managing
 * one — work the same way: POST to a route that mints a session, receive a
 * URL, leave. Neither ever handles a card, which is why there is no
 * Stripe.js on any page of this gallery and no CSP loosened to admit one.
 *
 * The shared part is the awkward part: staying disabled while the request is
 * in flight so a second click cannot mint a second session, and surfacing a
 * failure as a sentence rather than a dead button. `busy` is deliberately
 * never cleared on success — the page is navigating away, and flipping the
 * label back to its resting state first would suggest the click did nothing.
 */
export function useStripeRedirect(endpoint: string): StripeRedirect {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = useCallback(() => {
    setBusy(true);
    setError(null);
    fetch(endpoint, { method: "POST" })
      .then(async (response) => {
        const body = (await response.json()) as {
          url?: string;
          error?: string;
        };
        if (!response.ok || body.url === undefined) {
          throw new Error(body.error ?? "Stripe could not be reached.");
        }
        globalThis.location.assign(body.url);
      })
      .catch((cause: unknown) => {
        setBusy(false);
        setError(cause instanceof Error ? cause.message : "Something failed.");
      });
  }, [endpoint]);

  return { go, busy, error };
}
