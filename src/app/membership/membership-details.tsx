import {
  Ban,
  ChevronDown,
  CreditCard,
  DoorOpen,
  Info,
  MapPin,
  NotebookPen,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  BODY_SMALL,
  ITEM_HEADING,
  META,
  SECTION_HEADING,
} from "@/components/ui/field";
import { TextLink } from "@/components/ui/TextLink";
import { MEMBERSHIP, OPERATOR } from "@/lib/legal";

/**
 * What a membership is, said plainly — including the parts that do not
 * flatter it.
 *
 * The tone here is deliberate. A one-person site asking strangers for a
 * card every month has to earn that in the space of one screen, and the
 * things that actually earn it are the awkward ones: that not every
 * photograph has a location, that the card never reaches us, that cancelling
 * takes one click and keeps the time already paid for. Anything that reads
 * like marketing makes the rest less believable, so there is none.
 *
 * Icons are here to let somebody scan the page, not to decorate it — one per
 * row, always paired with a heading that says the same thing in words, and
 * `aria-hidden` because a reader who cannot see them loses nothing.
 */

/**
 * One point, with its icon.
 *
 * `tone` is not decoration. The accent means "this is what you are buying";
 * plain glass means "this is a limit on it". Colouring both alike — which is
 * what the first version of this did — turns the accent into a bullet point
 * and quietly tells the reader that a caveat is a feature.
 */
function Row({
  icon,
  heading,
  tone = "neutral",
  children,
}: {
  icon: ReactNode;
  heading: string;
  tone?: "accent" | "neutral";
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3.5">
      <span
        aria-hidden="true"
        className={`mt-0.5 flex size-8 flex-shrink-0 items-center justify-center rounded-full ${
          tone === "accent"
            ? "bg-accent-fill text-accent"
            : "bg-white/[0.06] text-white/60"
        }`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <h3 className={ITEM_HEADING}>{heading}</h3>
        <p className={`mt-1 text-pretty ${BODY_SMALL}`}>{children}</p>
      </div>
    </li>
  );
}

/**
 * The two things a membership actually buys, described.
 *
 * The fallback. `/membership` shows a real photograph with a real
 * photographer's two sentences on it whenever one exists — see
 * `MembershipSpecimen`. This runs when none does, which today is always:
 * both columns are empty on every row in the database. Describing the fields
 * is much weaker than showing them, and it is the only honest option when
 * there is nothing to show.
 */
export function WhatYouGet() {
  return (
    <section>
      <h2 className={SECTION_HEADING}>What you get</h2>
      <ul className="mt-5 space-y-5">
        <Row
          heading="Where it was taken"
          icon={<MapPin size={15} />}
          tone="accent"
        >
          Not a region — the spot, in the photographer's own words, and the
          point on the map if they marked one. Nothing is ever read from the
          image file: everything here is something a photographer decided to put
          there.
        </Row>
        <Row
          heading="How it was made"
          icon={<NotebookPen size={15} />}
          tone="accent"
        >
          The exposure is already on every photograph. This is the rest — the
          hour, the wait, what they would do differently.
        </Row>
      </ul>
    </section>
  );
}

/**
 * A section the reader can open, shut by default.
 *
 * Nothing here is hidden in the sense that matters — every word of the
 * limits and the money is still on the page, in the same order, one press
 * away, and `<details>` is findable by in-page search and read out by screen
 * readers whether or not it is open.
 *
 * What changed is the proportion. Two rows said what a membership gives and
 * six said what it does not, all at identical weight, which is not honesty —
 * honesty is saying the awkward things clearly, and this still does. It was
 * an editing failure: the caveats were three quarters of the page, so the
 * page read as a warning with a button in it.
 */
function Disclosure({
  summary,
  count,
  children,
}: {
  summary: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <details className="glass-hairline group rounded-2xl px-5">
      <summary className="-mx-5 flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 rounded-2xl font-medium text-white/85 text-sm marker:content-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80">
        {summary}
        <span className="flex items-center gap-2 text-white/55">
          <span className={META}>{`${count} things`}</span>
          <ChevronDown
            aria-hidden="true"
            className="transition-transform duration-200 group-open:rotate-180"
            size={16}
          />
        </span>
      </summary>
      <div className="pb-5">{children}</div>
    </details>
  );
}

/**
 * The limits, before the button rather than after it.
 *
 * This section costs conversions and is the reason the page can be trusted.
 * Every line here is something a disappointed member would otherwise have
 * discovered on their own, at which point it reads as a con rather than a
 * limitation.
 */
export function BeforeYouPay() {
  return (
    <Disclosure count={3} summary="What this is not">
      <ul className="space-y-5">
        <Row
          heading="Not every photograph has a location"
          icon={<Info size={15} />}
        >
          Photographers write these when they want to, for the photographs they
          choose. You are paying for what they have chosen to share, not for a
          guarantee that every picture carries a note.
        </Row>
        <Row
          heading="It is a small, growing gallery"
          icon={<Users size={15} />}
        >
          A handful of photographers, not thousands. If you want a large
          archive, this is not that, and it would be unfair not to say so before
          you pay.
        </Row>
        <Row
          heading="You are not buying the photographs"
          icon={<Ban size={15} />}
        >
          A membership grants no licence to any image. To use one, write to the
          photographer — they are all reachable from their page.
        </Row>
      </ul>
    </Disclosure>
  );
}

/** How the money works, in the plainest words available. */
export function HowPaymentWorks() {
  return (
    <Disclosure count={3} summary="How the money works">
      <ul className="space-y-5">
        <Row
          heading={`${MEMBERSHIP.price} a ${MEMBERSHIP.interval}, nothing else`}
          icon={<CreditCard size={15} />}
        >
          No setup fee, no tier above this one, no price that goes up after a
          first cheap month. If the price ever changes we will email you first,
          and you can leave.
        </Row>
        <Row heading="We never see your card" icon={<ShieldCheck size={15} />}>
          Payment happens on Stripe's own pages. This site stores your email
          address and whether the subscription is live — that is all it is told.
        </Row>
        <Row
          heading="Cancel in one click, keep what you paid for"
          icon={<DoorOpen size={15} />}
        >
          There is a cancel button on this page once you are a member. No email,
          no form, no notice period. Access runs to the end of the{" "}
          {MEMBERSHIP.interval} you have already paid for, and then stops.
        </Row>
      </ul>

      <p className="mt-6 text-[0.8125rem] text-white/55 leading-relaxed">
        Run by {OPERATOR.name} in {OPERATOR.country} — a real person, with an{" "}
        <TextLink href="/imprint">address and a name</TextLink> you can check.
        Read the <TextLink href="/terms">terms</TextLink> and the{" "}
        <TextLink href="/privacy">privacy policy</TextLink>, both of which are
        short.
      </p>
    </Disclosure>
  );
}
