import type { Metadata } from "next";
import { LegalPage, Section } from "@/app/legal/LegalPage";
import { TextLink } from "@/components/ui/TextLink";
import { MEMBERSHIP, OPERATOR } from "@/lib/legal";
import { alternates } from "@/lib/metadata";

export const metadata: Metadata = {
  title: "Terms — the beauty of earth.",
  description:
    "What a membership is, what it costs, how to end it, and what publishing here means.",
  alternates: alternates("/terms"),
};

/**
 * The terms of the membership, the withdrawal notice German law requires
 * beside them, and what a photographer agrees to by publishing here.
 *
 * Deliberately short. These govern a five-euro subscription that shows you
 * two extra fields, and the handful of things a photographer's own work gets
 * used for — and padding that out with clauses borrowed from a software
 * licence would obscure the parts that actually bind somebody.
 *
 * **The contributor section is a draft for the operator to review and edit.**
 * It was written by reading what the code actually does — the two feeds, the
 * composited share card, the announcement, the blob store — rather than from
 * a template, which makes it accurate about this site and unreviewed as law.
 * Everything it describes was already happening; nothing here is a new right
 * being taken. It said "these terms cover the membership only" while a
 * photographer had no written account of any of it.
 */
export default function TermsPage() {
  return (
    <LegalPage
      subtitle="What a membership is, what it costs, how to end it, and what publishing here means."
      title="Terms"
      updated="18 August 2026"
    >
      <Section heading="Who you are contracting with">
        <p>
          {OPERATOR.name}, whose full details are in the{" "}
          <TextLink href="/imprint">imprint</TextLink>. These terms cover two
          things: a membership, and publishing your photographs here as an
          invited contributor. Reading the gallery requires no agreement with
          anybody.
        </p>
      </Section>

      <Section heading="What a membership is">
        <p>
          For {MEMBERSHIP.price} per {MEMBERSHIP.interval} you see two things
          that are otherwise hidden: where each photograph was taken, in the
          photographer's own words, and a note on how it was made. That is the
          whole of it. The gallery, the photographs, the feeds and the mailing
          list are free and will stay free.
        </p>
        <p>
          Not every photograph has either. Photographers fill these in when they
          want to, for the photographs they want to, and a membership buys you
          what they have chosen to write — not a guarantee that something has
          been written.
        </p>
      </Section>

      <Section heading="Price and payment">
        <p>
          {MEMBERSHIP.price} per {MEMBERSHIP.interval}, charged by Stripe when
          you subscribe and on the same day each {MEMBERSHIP.interval}{" "}
          afterwards until you cancel.
          {OPERATOR.kleinunternehmer
            ? " No VAT is charged or shown, under §19 UStG."
            : " Prices include VAT at the applicable rate."}
        </p>
        <p>
          If a payment fails, Stripe retries it for a few days. Access pauses
          during that time and resumes if the payment clears. You can update
          your card at any time from the membership page.
        </p>
      </Section>

      <Section heading="Ending it">
        <p>
          Cancel whenever you like, from the{" "}
          <TextLink href="/membership">membership page</TextLink>, without
          asking anybody and without giving a reason. Cancelling stops the next
          payment; access continues to the end of the period you have already
          paid for. There is no minimum term and no notice period.
        </p>
      </Section>

      {/*
        Required by §312d BGB with Art. 246a EGBGB. The consent to immediate
        performance is what the checkout button obtains, and it is why the
        fourteen-day right ends early — so both halves have to be stated, not
        just the convenient one.
      */}
      <Section heading="Right of withdrawal">
        <p>
          As a consumer in the EU you have fourteen days to withdraw from this
          contract without giving a reason, counted from the day it is
          concluded. To withdraw, tell us plainly — an email to{" "}
          <a
            className="underline decoration-white/25 underline-offset-4 transition-colors hover:text-white"
            href={`mailto:${OPERATOR.email}`}
          >
            {OPERATOR.email}
          </a>{" "}
          is enough. We will refund every payment received within fourteen days
          of being told.
        </p>
        <p>
          <strong className="font-medium text-white/85">
            When that right ends early.
          </strong>{" "}
          By subscribing you ask us to begin immediately and acknowledge that
          you lose the right of withdrawal once we have fully performed. In
          practice, if you cancel within fourteen days we will refund you
          regardless — it is five euros, and arguing about it would cost
          everybody more than the refund.
        </p>
      </Section>

      <Section heading="What you may do with the photographs">
        <p>
          Look at them. Every photograph belongs to the photographer credited
          beneath it, and a membership grants no licence to any of them —
          neither to the images nor to the locations you can now read. Do not
          republish either. If you want to use a photograph, write to the
          photographer; several are reachable from their page here.
        </p>
      </Section>

      <Section heading="If you publish photographs here">
        <p>
          Your photographs stay yours. Nothing here transfers copyright, and you
          can unpublish or delete any of them at any time from your own page.
          What you give is permission to show them, and only in the places this
          site shows things.
        </p>
        <p>
          Those places are: the gallery and your own page; the RSS feed and the
          sitemap; a share card generated for links to your page, which places
          up to three of your photographs side by side; and one announcement
          email to people who asked to hear when new work appears. Your name,
          the site address you gave us, and anything you wrote about a
          photograph appear alongside it. The files themselves are stored with
          Vercel, listed with everyone else in the{" "}
          <TextLink href="/privacy">privacy notice</TextLink>.
        </p>
        <p>
          What we do not do: sell them, licence them to anybody else, or hand
          them to a third party for anything but the storage and delivery
          described in that notice. A model is shown a photograph only when you
          press the button that asks it for a suggestion, and it is shown the
          published copy, never the file off your camera.
        </p>
        <p>
          Publish only work that is yours to publish, and that you are willing
          to have read by anybody. If you ask us to remove you, we delete your
          photographs, the stored files behind them, and your account. Copies
          already sent by email or held in somebody else&rsquo;s cache are
          beyond anybody&rsquo;s reach, which is true of everything ever
          published and is the reason to be sure before pressing publish.
        </p>
      </Section>

      <Section heading="Availability">
        <p>
          This is a small site run by one person. We aim to keep it up and
          usually do, but nothing here is a guaranteed service level. If it is
          down long enough to matter, write to us and we will sort out your
          membership fairly.
        </p>
      </Section>

      <Section heading="Changes">
        <p>
          If these terms change in a way that affects members, we will email the
          address on your membership before it takes effect, and you can cancel.
          Continuing after that is acceptance.
        </p>
      </Section>

      <Section heading="Law">
        <p>
          German law applies. If you are a consumer, this does not deprive you
          of the protections of the law of the country you live in.
        </p>
      </Section>
    </LegalPage>
  );
}
