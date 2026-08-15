"use client";

import { useCallback, useState } from "react";
import { GlassButton } from "@/components/ui/glass-button";

/**
 * Sends somebody to Stripe's hosted checkout.
 *
 * A redirect rather than an embedded form, which keeps Stripe.js off every
 * page of this site: no third-party script in the gallery, and no CSP to
 * loosen for one that would only ever run here.
 */
export function SubscribeButton({ signedIn }: { signedIn: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(() => {
    setBusy(true);
    setError(null);
    fetch("/api/stripe/checkout", { method: "POST" })
      .then(async (response) => {
        const body = (await response.json()) as {
          url?: string;
          error?: string;
        };
        if (!response.ok || body.url === undefined) {
          throw new Error(body.error ?? "Could not start checkout.");
        }
        globalThis.location.assign(body.url);
      })
      .catch((cause: unknown) => {
        setBusy(false);
        setError(cause instanceof Error ? cause.message : "Something failed.");
      });
  }, []);

  if (!signedIn) {
    return (
      <p className="text-sm text-white/55">
        Membership is tied to your email address, so sign in first — the same
        one-time link contributors use.
      </p>
    );
  }

  return (
    <div>
      <GlassButton disabled={busy} onClick={start}>
        {busy ? "Opening checkout…" : "Become a member"}
      </GlassButton>
      {error === null ? null : (
        <p className="mt-2 text-sm text-white/70" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
