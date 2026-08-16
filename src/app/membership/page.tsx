import type { Metadata } from "next";
import Link from "next/link";
import { ContributeShell } from "@/app/contribute/ContributeShell";
import { TOUCH_LINK } from "@/components/ui/field";
import { getSessionEmail, memberForSession } from "@/lib/auth/session";
import { MEMBERSHIP } from "@/lib/legal";
import { isActive } from "@/lib/members/status";
import { alternates } from "@/lib/metadata";
import { membershipConfigured } from "@/lib/stripe";
import {
  BeforeYouPay,
  HowPaymentWorks,
  WhatYouGet,
} from "./membership-details";
import { ManageButton, SubscribeButton } from "./SubscribeButton";

export const metadata: Metadata = {
  title: "Membership — the beauty of earth.",
  description:
    "See exactly where each photograph was taken, and how it was made. €5 a month, cancel any time.",
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
export default async function MembershipPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const [{ welcome }, email, billing] = await Promise.all([
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
      subtitle={`See exactly where each photograph was taken, and how it was made. ${MEMBERSHIP.price} a ${MEMBERSHIP.interval}.`}
      title="Membership"
    >
      <div className="max-w-prose space-y-8">
        {member === null ? null : (
          <p className="glass-hairline rounded-2xl px-4 py-3 text-sm text-white/70">
            You are a member. The location and the notes appear under every
            photograph.{" "}
            <Link
              className="text-white/80 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white"
              href="/"
            >
              Go and look
            </Link>
            .
          </p>
        )}

        {justPaid ? (
          <div
            aria-live="polite"
            className="glass-hairline space-y-3 rounded-2xl px-4 py-3 text-sm text-white/70"
          >
            <p>
              Payment received — Stripe is confirming it now, which usually
              takes a few seconds. You have not been charged twice.
            </p>
            {email === null ? (
              /*
               * A new member, still anonymous: the payment is done and they
               * have no session, so reloading would show them nothing. The
               * next step is signing in with the address they just paid
               * with, and this is the only place they will be told.
               */
              <p>
                One step left:{" "}
                <Link
                  className="text-white/85 underline decoration-white/30 underline-offset-4 transition-colors hover:text-white"
                  href="/contribute"
                >
                  sign in with the address you paid with
                </Link>{" "}
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
        ) : null}

        <WhatYouGet />

        {member === null && !justPaid ? (
          <SubscribeSection signedIn={email !== null} />
        ) : null}

        {billing === null ? null : <ManageButton />}

        {/*
          The limits and the money come after the button, not instead of it:
          somebody scrolling to decide reads them, and somebody who has
          already decided is not made to wade through them first.
        */}
        {member === null ? <BeforeYouPay /> : null}
        <HowPaymentWorks />

        <p className="text-sm text-white/45">
          The gallery, the feeds and the photographs stay free and always will.
          A membership buys the things only the photographer can tell you.{" "}
          {/*
            Linked from the page that sells, not only from the footer. The
            withdrawal right and the cancellation rule live there, and both
            are things somebody deciding whether to pay is entitled to read
            first rather than discover afterwards.
          */}
          <Link
            className="underline decoration-white/20 underline-offset-4 transition-colors hover:text-white/70"
            href="/terms"
          >
            Terms
          </Link>
          .
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
        <p className="mt-3 text-sm text-white/45">
          Already a member?{" "}
          <Link
            className={`${TOUCH_LINK} text-white/70 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white hover:decoration-white/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80`}
            href="/contribute"
          >
            Sign in
          </Link>{" "}
          instead — it takes one email.
        </p>
      )}
    </section>
  );
}
