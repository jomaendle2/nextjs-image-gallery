"use client";

import { GlassButton } from "@/components/ui/glass-button";
import { useStripeRedirect } from "@/hooks/useStripeRedirect";

/**
 * Sends somebody to Stripe's hosted checkout.
 *
 * A redirect rather than an embedded form, which keeps Stripe.js off every
 * page of this site: no third-party script in the gallery, and no CSP to
 * loosen for one that would only ever run here.
 */
export function SubscribeButton({ signedIn }: { signedIn: boolean }) {
  const { go, busy, error } = useStripeRedirect("/api/stripe/checkout");

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
      <GlassButton disabled={busy} onClick={go}>
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

/**
 * Sends a member to Stripe's billing portal.
 *
 * Cancelling has to be as easy as subscribing — both because it is the law
 * where this is sold from, and because a membership you cannot leave without
 * emailing someone is a worse product than one you can.
 */
export function ManageButton() {
  const { go, busy, error } = useStripeRedirect("/api/stripe/portal");

  return (
    <div>
      <button
        className="-my-3 inline-flex min-h-11 items-center rounded-full py-3 text-sm text-white/60 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white hover:decoration-white/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80 disabled:opacity-50"
        disabled={busy}
        onClick={go}
        type="button"
      >
        {busy ? "Opening…" : "Manage or cancel your membership"}
      </button>
      {error === null ? null : (
        <p className="mt-2 text-sm text-white/70" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
