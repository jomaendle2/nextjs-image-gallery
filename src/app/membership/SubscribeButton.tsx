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

  return (
    <div>
      <GlassButton disabled={busy} onClick={go}>
        {busy ? "Opening checkout…" : "Become a member"}
      </GlassButton>
      {signedIn ? null : (
        /*
         * Said before paying, not after. A membership is tied to an address
         * and unlocked by a link sent to it, so which address you type at
         * Stripe is a decision rather than a detail — and finding that out
         * on the receipt is too late to change it.
         */
        <p className="mt-3 text-sm text-white/45">
          Use an address you can read: your membership is unlocked by a link
          sent there, and it is how you will sign in afterwards.
        </p>
      )}
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
