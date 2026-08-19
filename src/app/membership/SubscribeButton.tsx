"use client";

import { GlassButton } from "@/components/ui/glass-button";
import { useStripeRedirect } from "@/hooks/useStripeRedirect";
import { MEMBERSHIP } from "@/lib/legal";

/**
 * Sends somebody to Stripe's hosted checkout, at one of two cadences.
 *
 * A redirect rather than an embedded form, which keeps Stripe.js off every
 * page of this site: no third-party script in the gallery, and no CSP to
 * loosen for one that would only ever run here.
 *
 * Two hooks rather than one, because each button owns its own request. They
 * share a disabled state, though — while either is in flight both are dead,
 * so a second click on the other cannot mint a second checkout session for
 * somebody who is already halfway to Stripe with the first.
 */
export function SubscribeButton({
  signedIn,
  annual,
}: {
  signedIn: boolean;
  /**
   * Whether the year-at-a-time price exists.
   *
   * A prop rather than an `annualOffered()` call, for the reason `SiteNav`
   * gives about `membershipOffered`: this is a client component, so reading
   * `process.env` here returns undefined for everybody and would hide the
   * button in production while every test kept passing.
   */
  annual: boolean;
}) {
  const monthly = useStripeRedirect("/api/stripe/checkout");
  const yearly = useStripeRedirect("/api/stripe/checkout", { plan: "annual" });

  const busy = monthly.busy || yearly.busy;
  const error = monthly.error ?? yearly.error;

  /*
   * The labels, built here rather than ternaried inside the JSX.
   *
   * Three states each — busy, alone, beside the other — is a nested ternary
   * in an attribute position, and both `noNestedTernary` and
   * `noLeakedRender` are right to object. It also reads better as prose: the
   * month says the whole sentence when it stands alone and only its price
   * when the year is beside it, because the row already says what it is.
   */
  const monthlyPrice = `${MEMBERSHIP.price} a ${MEMBERSHIP.interval}`;
  const monthlyResting = annual
    ? monthlyPrice
    : `Start my membership — ${monthlyPrice}`;
  const monthlyLabel = monthly.busy ? "Opening checkout…" : monthlyResting;
  /** What the small print calls the billing rhythm, which now varies. */
  const cadence = annual
    ? "every month or every year — whichever you chose"
    : `every ${MEMBERSHIP.interval}`;
  const yearlyLabel = yearly.busy
    ? "Opening checkout…"
    : `${MEMBERSHIP.annualPrice} a ${MEMBERSHIP.annualInterval} — save ${MEMBERSHIP.annualSaving}`;

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

        With two cadences the year is the primary and the month is plain
        glass, which is one primary per view and not two. That ordering is a
        claim about the reader as much as about us: the annual price is the
        cheaper of the two per month and the saving is named on the button,
        so the accent is pointing at the better deal rather than merely at
        the larger payment. Somebody who would rather commit to a month can
        still do it in one click, beside it, at full size.
      */}
      <div className="flex flex-col gap-2.5 sm:flex-row">
        {annual ? (
          <GlassButton
            disabled={busy}
            fullWidth={true}
            onClick={yearly.go}
            variant="primary"
          >
            {yearlyLabel}
          </GlassButton>
        ) : null}
        <GlassButton
          disabled={busy}
          fullWidth={true}
          onClick={monthly.go}
          /*
           * Primary only when it is alone. Two accent fills on one row is
           * the state `design.test.ts` calls "neither is primary".
           */
          variant={annual ? "default" : "primary"}
        >
          {monthlyLabel}
        </GlassButton>
      </div>

      {/*
        One block of small print, not three paragraphs each hung off the
        button with its own margin. They had accumulated `mt-2`, `mt-3` and
        `mt-2` and read as three separate afterthoughts crowding the control
        they belong to; `mt-5` puts real air under the button and `space-y-2`
        makes the rest one group.
      */}
      <div className="mt-5 space-y-2 text-sm text-white/55">
        <p>
          Billed by Stripe, {cadence}, until you cancel. Cancel any time in one
          click — no notice period.
        </p>
        {annual ? (
          /*
           * Said before paying, because it is the one thing the annual price
           * costs somebody: cancelling stops the next renewal rather than
           * refunding the rest of the year. Burying that under the cheaper
           * per-month figure is exactly the trick this page does not play.
           */
          <p>
            Cancelling a year keeps the months you have paid for and stops the
            renewal. It is not refunded part-way.
          </p>
        ) : null}
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
