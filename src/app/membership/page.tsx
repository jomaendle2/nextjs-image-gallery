import type { Metadata } from "next";
import { signOut } from "@/app/contribute/actions";
import { ContributeShell } from "@/app/contribute/ContributeShell";
import { GlassButton } from "@/components/ui/glass-button";
import { TextLink } from "@/components/ui/TextLink";
import { getSessionEmail, memberForSession } from "@/lib/auth/session";
import { MEMBERSHIP } from "@/lib/legal";
import { membershipConfigured } from "@/lib/members/offer";
import { isActive } from "@/lib/members/status";
import { alternates } from "@/lib/metadata";
import { getSpecimenPhoto } from "@/lib/photos/repository";
import { MembershipSpecimen } from "./MembershipSpecimen";
import {
  BeforeYouPay,
  HowPaymentWorks,
  WhatYouGet,
} from "./membership-details";
import { ManageButton, SubscribeButton } from "./SubscribeButton";

export const metadata: Metadata = {
  title: "Membership — the beauty of earth.",
  description: `See exactly where each photograph was taken, and how it was made. ${MEMBERSHIP.price} a ${MEMBERSHIP.interval}, cancel any time.`,
  alternates: alternates("/membership"),
};

/**
 * What a membership is, and the way in.
 *
 * Dynamic by necessity — it reads the session to know whether to offer
 * checkout, a thank-you, or a sign-in prompt. That is fine here and would
 * not be on the gallery, which is why the member gate on a photograph is a
 * separate request rather than a prop threaded through a cached page.
 */

/**
 * Which of five readers this is, and what each needs told.
 *
 * Extracted because the page component was branching across all of them
 * inline and biome's complexity rule was right to object: the states are
 * mutually exclusive and the ordering between them is load-bearing, which is
 * exactly the kind of thing that should be readable in one place rather than
 * threaded between a specimen and a subscribe button.
 */
function MembershipStatus({
  member,
  justPaid,
  lapsed,
  email,
}: {
  member: boolean;
  justPaid: boolean;
  lapsed: boolean;
  email: string | null;
}) {
  if (member) {
    return (
      <p className="glass-hairline rounded-2xl px-4 py-3 text-sm text-white/70">
        You are a member. The location and the notes appear under every
        photograph. <TextLink href="/">Go and look</TextLink>.
      </p>
    );
  }

  if (justPaid) {
    return (
      <div
        aria-live="polite"
        className="glass-hairline space-y-3 rounded-2xl px-4 py-3 text-sm text-white/70"
      >
        <p>
          Payment received — Stripe is confirming it now, which usually takes a
          few seconds. You have not been charged twice.
        </p>
        {email === null ? (
          /*
           * A new member, still anonymous: the payment is done and they have
           * no session, so reloading would show them nothing. The next step
           * is signing in with the address they just paid with, and this is
           * the only place they will be told.
           */
          <p>
            One step left:{" "}
            <TextLink href="/contribute">
              sign in with the address you paid with
            </TextLink>{" "}
            to unlock it. We will email you a link — there is no password to
            choose.
          </p>
        ) : (
          <p>
            Reload this page in a moment and the locations will be there.
            Nothing more is needed from you.
          </p>
        )}
      </div>
    );
  }

  if (lapsed) {
    return (
      <div className="glass-hairline space-y-3 rounded-2xl px-4 py-3 text-sm text-white/70">
        <p>
          Your membership is not active at the moment — usually a card that has
          expired or a payment the bank declined. Nothing has been lost:
          updating the card puts the locations straight back.
        </p>
        <ManageButton />
      </div>
    );
  }

  return null;
}

export default async function MembershipPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const [{ welcome }, email, billing, specimen] = await Promise.all([
    searchParams,
    getSessionEmail(),
    /*
     * The billing record, which outlives the entitlement.
     *
     * Deliberately not the entitlement: somebody whose card is failing has
     * no access and the most urgent reason of anyone to reach the portal.
     * Gating the way out on having access would lock the people who need it
     * out of it.
     */
    memberForSession(),
    /*
     * The photograph the page sells with. Fetched unconditionally and in
     * parallel with the rest: it is a single indexed row, and branching on
     * the session first would put it on the critical path for exactly the
     * readers who most need the page to be fast — the ones who have not paid
     * yet.
     *
     * It sat on its own `await` below this block for a while, under a
     * comment already claiming it ran in parallel. It did not: the session
     * lookups had to settle first, so the page cost three serial round trips
     * where it now costs the slowest of four.
     */
    getSpecimenPhoto(),
  ]);

  /*
   * Entitlement is a predicate over that row, not a second question for the
   * database. This page used to ask four times — the session, then
   * `getCurrentMember` (which re-read the session and then the member), then
   * the same member row again for billing — where two round trips answer
   * everything, and they now run in parallel.
   */
  const member = isActive(billing) ? billing : null;

  /*
   * Just back from checkout, but the webhook has not landed yet.
   *
   * Stripe redirects the browser the moment the payment clears and delivers
   * the event separately, so for a second or two somebody who has genuinely
   * paid looks exactly like somebody who has not. Without this they would
   * come back to a "Become a member" button and reasonably conclude the
   * payment failed — and quite possibly pay again.
   */
  const justPaid = welcome === "1" && member === null;

  /*
   * Paid once, not paying now — `past_due`, `unpaid`, or cancelled.
   *
   * This state had no UI at all. It fell through to the non-member page, so
   * a member whose card had expired was shown the full pitch for a thing
   * they had already bought, and pressing the button returned a 409 telling
   * them the address already had a membership. The one thing they needed —
   * the portal, to fix the card — was a text link below the pitch.
   *
   * `justPaid` wins over this: somebody back from checkout whose webhook has
   * not landed also has no entitlement, and telling them their payment
   * failed would be both wrong and alarming.
   */
  const lapsed = billing !== null && member === null && !justPaid;

  if (!membershipConfigured()) {
    return (
      <ContributeShell subtitle="Not open yet." title="Membership">
        <p className="max-w-prose text-sm text-white/55">
          Memberships are not on sale at the moment. The gallery itself stays
          free either way.
        </p>
      </ContributeShell>
    );
  }

  return (
    <ContributeShell
      action={
        /*
         * The only sign-out a member has.
         *
         * It was wired into the contributor dashboard alone, which a member
         * cannot reach — so somebody with a thirty-day cookie on a borrowed
         * laptop had no way to end the session at all.
         */
        email === null ? undefined : (
          <form action={signOut}>
            <GlassButton size="sm" type="submit">
              Sign out
            </GlassButton>
          </form>
        )
      }
      subtitle={`See exactly where each photograph was taken, and how it was made. ${MEMBERSHIP.price} a ${MEMBERSHIP.interval}.`}
      title="Membership"
    >
      {/*
        The column runs the full width of the shell rather than stopping at
        `max-w-prose`. That cap is right for prose and was wrong for this
        page: it left roughly a third of the shell empty while the specimen
        underneath it had to stack instead of sitting side by side. The
        paragraphs that are actually prose keep their own cap.
      */}
      <div className="space-y-8">
        <MembershipStatus
          email={email}
          justPaid={justPaid}
          lapsed={lapsed}
          member={member !== null}
        />

        {/*
          Show the thing, do not describe it. `WhatYouGet` is the fallback for
          a gallery where no photographer has filled in either field yet —
          which is every photograph today.
        */}
        {specimen === null ? (
          <WhatYouGet />
        ) : (
          <MembershipSpecimen photo={specimen} />
        )}

        {member === null && !justPaid && !lapsed ? (
          <SubscribeSection signedIn={email !== null} />
        ) : null}

        {member === null || billing === null ? null : <ManageButton />}

        {/*
          The limits and the money come after the button, not instead of it:
          somebody scrolling to decide reads them, and somebody who has
          already decided is not made to wade through them first.

          Both are collapsed now. Every word is still here and still in this
          order — see `Disclosure` — but eight rows of equal weight had made
          the caveats three quarters of the page.
        */}
        <div className="space-y-3">
          {member === null ? <BeforeYouPay /> : null}
          <HowPaymentWorks />
        </div>

        <p className="max-w-prose text-sm text-white/55">
          The gallery, the feeds and the photographs stay free and always will.
          A membership buys the things only the photographer can tell you.{" "}
          {/*
            Linked from the page that sells, not only from the footer. The
            withdrawal right and the cancellation rule live there, and both
            are things somebody deciding whether to pay is entitled to read
            first rather than discover afterwards.
          */}
          <TextLink href="/terms">Terms</TextLink>.
        </p>
      </div>
    </ContributeShell>
  );
}

function SubscribeSection({ signedIn }: { signedIn: boolean }) {
  return (
    <section>
      <SubscribeButton signedIn={signedIn} />
      {signedIn ? null : (
        /*
         * For somebody who is already a member on another device, not for
         * the buyer. Signing in used to be a precondition of paying; now it
         * is only the way back to a membership you already have, and saying
         * otherwise would send new members down a route that refuses them.
         */
        <p className="mt-5 border-white/[0.08] border-t pt-4 text-sm text-white/55">
          Already a member? <TextLink href="/contribute">Sign in</TextLink>{" "}
          instead — it takes one email.
        </p>
      )}
    </section>
  );
}
