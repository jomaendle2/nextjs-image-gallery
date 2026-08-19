import { Check } from "lucide-react";
import type { Metadata } from "next";
import { ContributeShell } from "@/app/contribute/ContributeShell";
import { BODY, BODY_SMALL, META, SECTION_HEADING } from "@/components/ui/field";
import { Notice } from "@/components/ui/Notice";
import { SiteNav } from "@/components/ui/SiteNav";
import { TextLink } from "@/components/ui/TextLink";
import { membershipConfigured } from "@/lib/members/offer";
import { alternates } from "@/lib/metadata";
import { type EarlyAccessTier, TIERS } from "@/lib/waitlist/tiers";
import { EarlyAccessForm } from "./EarlyAccessForm";

export const metadata: Metadata = {
  title: "Pricing — the beauty of earth.",
  description:
    "The gallery is free. A membership shows where each photograph was taken. Two further tiers are proposals, and this page is how they get decided.",
  alternates: alternates("/pricing"),
};

/**
 * Everything the site charges for, and two things it does not charge for yet.
 *
 * This page is a demand test wearing a price list. Pro and Spaces are not
 * built, cannot be bought, and say so in those words above their own forms —
 * because the number this page exists to produce is only worth having if the
 * people in it understood what they were answering. A register of people who
 * thought they had subscribed to something measures nothing except how
 * convincing the layout was.
 *
 * Static. Nothing here reads a session — the membership page owns everything
 * that depends on who is asking, and this one only needs to know whether
 * payments are switched on at all, which is an environment variable.
 */

/** The four rungs, drawn the same way so the ladder is legible as one. */
function TierCard({
  tier,
  offered,
}: {
  tier: (typeof TIERS)[number];
  /** Whether membership is on sale, which only the live paid rung cares about. */
  offered: boolean;
}) {
  return (
    <section className="glass-thin rounded-3xl p-6">
      <header className="mb-4">
        <p className={META}>{tier.label}</p>
        <h2 className={`mt-1 ${SECTION_HEADING}`}>{tier.name}</h2>
        <p className="mt-1 font-medium text-white">{tier.price}</p>
        {tier.priceNote === undefined ? null : (
          <p className={BODY_SMALL}>{tier.priceNote}</p>
        )}
        <p className={`mt-2 max-w-prose ${BODY}`}>{tier.who}</p>
      </header>

      <ul className="space-y-2">
        {tier.includes.map((line) => (
          <li className="flex gap-2.5" key={line}>
            <Check
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-white/55"
              size={15}
            />
            <span className={BODY_SMALL}>{line}</span>
          </li>
        ))}
      </ul>

      {/*
        The limit, in every card, at the same weight as the promises above
        it. `/membership` earned its way by listing the things that do not
        flatter the offer, and a price list that dropped the habit at the
        moment it started naming larger numbers would be the version of this
        site that stopped being worth trusting.
      */}
      <p className={`mt-4 max-w-prose ${BODY_SMALL}`}>{tier.limit}</p>

      <div className="mt-5">
        <TierAction offered={offered} tier={tier} />
      </div>
    </section>
  );
}

/** What each rung offers a reader to do about it — which for two is nothing. */
function TierAction({
  tier,
  offered,
}: {
  tier: (typeof TIERS)[number];
  offered: boolean;
}) {
  if (tier.id === "free") {
    return (
      <p className={BODY_SMALL}>
        Nothing to do. <TextLink href="/">Open the gallery</TextLink>.
      </p>
    );
  }

  if (tier.id === "member") {
    return offered ? (
      <p className={BODY_SMALL}>
        <TextLink href="/membership">Read what a membership is</TextLink>, and
        start one there.
      </p>
    ) : (
      <p className={BODY_SMALL}>
        Memberships are not on sale at the moment. The gallery stays free either
        way.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/*
        Said before the form rather than after it, and as a warning rather
        than a note. Somebody who reads the price, fills in an address and
        then learns there was nothing to buy has been misled by the shape of
        the page even if every word on it was true.
      */}
      <Notice>
        This one is not built. There is nothing to pay and nothing to cancel —
        leaving an address here is how you get told if it becomes real, and how
        we decide whether to build it at all.
      </Notice>
      <EarlyAccessForm
        label={`Tell me when ${tier.name} exists`}
        tier={tier.id as EarlyAccessTier}
      />
    </div>
  );
}

export default function PricingPage() {
  const offered = membershipConfigured();

  return (
    <ContributeShell
      nav={<SiteNav current="pricing" membershipOffered={offered} />}
      subtitle="What the gallery costs, what a membership adds, and two things that do not exist yet."
      title="Pricing"
    >
      <div className="space-y-8">
        <p className={`max-w-prose ${BODY}`}>
          Looking at photographs here is free and stays free. Two of the four
          things below can be bought today; the other two are proposals with a
          form under them, and whether they get built depends on how many people
          fill one in.
        </p>

        <div className="space-y-4">
          {TIERS.map((tier) => (
            <TierCard key={tier.id} offered={offered} tier={tier} />
          ))}
        </div>

        <section className="space-y-3">
          <h2 className={SECTION_HEADING}>
            Why Spaces cannot simply be switched on
          </h2>
          <p className={`max-w-prose ${BODY}`}>
            Photographers here are told, in the terms, that we do not licence
            their work to anybody else — and a screen in a hotel lobby is
            exactly that. So a commercial display tier cannot be built by
            writing code alone: it needs a separate agreement each photographer
            opts into per photograph, with a share of what it earns, and none of
            that exists yet. Saying so here rather than after somebody has paid
            is the whole reason this page has a form instead of a checkout.{" "}
            <TextLink href="/terms">Terms</TextLink>.
          </p>
        </section>

        <p className={`max-w-prose ${BODY_SMALL}`}>
          An address left on this page is used once, to answer you about the
          thing you asked about, and is not added to the mailing list. If you
          want the list as well,{" "}
          <TextLink href="/subscribe">subscribe</TextLink> — it is a separate
          decision and a separate confirmation.
        </p>
      </div>
    </ContributeShell>
  );
}
