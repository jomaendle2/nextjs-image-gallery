"use client";

import { GlassButton } from "@/components/ui/glass-button";
import { useStripeRedirect } from "@/hooks/useStripeRedirect";
import { MEMBERSHIP } from "@/lib/legal";

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
      {/*
        The price is on the button, not merely near it.

        German law wants the cost and the recurrence unmistakable at the
        moment of commitment (§312j BGB), and "Become a member" satisfies
        neither — it does not even say that money is involved. This is also
        just honest: a button that hides its price is a button people click
        to find out, which is not consent.

        The verb changed from "Become a member" to "Start my membership":
        first person, and a thing you do rather than a state you enter. The
        price and the recurrence stay exactly where the law wants them.
      */}
      <GlassButton
        disabled={busy}
        fullWidth={true}
        onClick={go}
        variant="primary"
      >
        {busy
          ? "Opening checkout…"
          : `Start my membership — ${MEMBERSHIP.price} a ${MEMBERSHIP.interval}`}
      </GlassButton>

      {/*
        One block of small print, not three paragraphs each hung off the
        button with its own margin. They had accumulated `mt-2`, `mt-3` and
        `mt-2` and read as three separate afterthoughts crowding the control
        they belong to; `mt-5` puts real air under the button and `space-y-2`
        makes the rest one group.
      */}
      <div className="mt-5 space-y-2 text-sm text-white/55">
        <p>
          Billed by Stripe, every {MEMBERSHIP.interval}, until you cancel.
          Cancel any time in one click — no notice period.
        </p>
        {signedIn ? null : (
          /*
           * Said before paying, not after. A membership is tied to an address
           * and unlocked by a link sent to it, so which address you type at
           * Stripe is a decision rather than a detail — and finding that out
           * on the receipt is too late to change it.
           */
          <p>
            Use an address you can read: your membership is unlocked by a link
            sent there, and it is how you will sign in afterwards.
          </p>
        )}
      </div>
      {error === null ? null : (
        <p className="mt-3 text-sm text-white/70" role="alert">
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
