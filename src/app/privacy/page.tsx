import type { Metadata } from "next";
import { LegalPage, Section } from "@/app/legal/LegalPage";
import { TextLink } from "@/components/ui/TextLink";
import { OPERATOR, PROCESSORS } from "@/lib/legal";
import { alternates } from "@/lib/metadata";

export const metadata: Metadata = {
  title: "Privacy — the beauty of earth.",
  description:
    "What this site stores, who it is shared with, and how to get rid of it.",
  alternates: alternates("/privacy"),
};

/**
 * What the site actually does with data, written from the code rather than
 * from a template.
 *
 * Every claim here is checkable against a file, and several are unusual
 * enough to be worth stating plainly: no coordinates are ever read from a
 * photograph, and no record is kept of which member looked at what. A policy
 * that describes a generic website would be both less useful and less true.
 */
export default function PrivacyPage() {
  return (
    <LegalPage
      subtitle="What is stored, who sees it, and how to get rid of it."
      title="Privacy"
      updated="15 August 2026"
    >
      <Section heading="The short version">
        <p>
          You can read this entire gallery without giving us anything. There is
          no cookie banner because there is nothing to consent to: no
          advertising, no tracking across sites, no profile of you. The only
          cookie is the one that keeps you signed in, and it is only set once
          you sign in.
        </p>
      </Section>

      <Section heading="What we store, and why">
        <ul className="space-y-3">
          <li>
            <strong className="font-medium text-white/85">
              Your email address
            </strong>{" "}
            — if you subscribe to the list, apply to contribute, or buy a
            membership. It is the only identifier we hold. There is no password
            to store because there are no passwords: signing in is a one-time
            link sent to that address.
          </li>
          <li>
            <strong className="font-medium text-white/85">
              Your application
            </strong>{" "}
            — the name, website and note you type on the apply form, kept so we
            can answer it.
          </li>
          <li>
            <strong className="font-medium text-white/85">
              Your subscription
            </strong>{" "}
            — if you become a member, we store a Stripe customer reference and
            whether the subscription is live. We never see or store your card.
          </li>
          <li>
            <strong className="font-medium text-white/85">Server logs</strong> —
            our host records requests, including IP addresses, for a short
            period. We do not read them for anything but faults.
          </li>
        </ul>
      </Section>

      <Section heading="What we deliberately do not store">
        <ul className="space-y-3">
          <li>
            <strong className="font-medium text-white/85">
              Where a photograph was taken
            </strong>
            , unless the photographer wrote it themselves. The GPS block in an
            image file is never read and never stored — the camera and exposure
            are taken from the file, the coordinates are skipped. The image the
            gallery serves is a fresh copy that carries no metadata at all, so
            downloading it tells you nothing about where anybody stood. When a
            member sees a location, it is a sentence a photographer chose to
            type, not a coordinate extracted from a file.
          </li>
          <li>
            <strong className="font-medium text-white/85">
              Who looked at what.
            </strong>{" "}
            We count how many times each photograph is viewed by members, per
            day, so that photographers could one day be paid by what people
            actually look at. That count is a number against a photograph. It is
            not linked to you, and there is no table anywhere that could
            reconstruct your viewing history.
          </li>
        </ul>
      </Section>

      <Section heading="Cookies">
        <p>
          One: <code className="text-white/80">gallery_session</code>, set only
          when you sign in. It holds a random value that means nothing outside
          our database, is marked{" "}
          <code className="text-white/80">HttpOnly</code> so no script can read
          it, and lasts thirty days. Signing out deletes it immediately and
          everywhere — sessions are stored on our side, so removing one really
          does end it.
        </p>
        <p>
          Our analytics sets no cookies at all and collects nothing that
          identifies a person.
        </p>
      </Section>

      <Section heading="Who else receives it">
        <p>
          Only the services needed to run the site. Each is bound by a data
          processing agreement, and none receives more than is listed here.
        </p>
        {/*
          A list on a phone, a table on a screen wide enough for one.

          This was a 544px-wide table inside a 342px column, scrolling
          sideways with no affordance saying so and no way for a keyboard to
          reach the third column — on the page a reader is most likely to
          have arrived at for a specific fact. Making it focusable would have
          satisfied the checker; not needing to scroll satisfies the reader.
        */}
        <dl className="space-y-4 sm:hidden">
          {PROCESSORS.map((processor) => (
            <div className="space-y-1" key={processor.name}>
              <dt className="font-medium text-[0.8125rem] text-white/85">
                {processor.name}
              </dt>
              <dd className="text-[0.8125rem] text-white/75">
                {processor.role}
              </dd>
              <dd className="text-[0.8125rem] text-white/55">
                {processor.data}
              </dd>
            </div>
          ))}
        </dl>

        <table className="hidden w-full border-collapse text-[0.8125rem] sm:table">
          <thead>
            <tr className="border-white/10 border-b text-left text-white/55">
              <th className="py-2 pr-4 font-medium" scope="col">
                Service
              </th>
              <th className="py-2 pr-4 font-medium" scope="col">
                Purpose
              </th>
              <th className="py-2 font-medium" scope="col">
                What it receives
              </th>
            </tr>
          </thead>
          <tbody>
            {PROCESSORS.map((processor) => (
              <tr className="border-white/5 border-b" key={processor.name}>
                <td className="py-3 pr-4 align-top text-white/75">
                  {processor.name}
                </td>
                <td className="py-3 pr-4 align-top">{processor.role}</td>
                <td className="py-3 align-top text-white/55">
                  {processor.data}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-sm text-white/55">
          Some of these are US companies. Transfers rely on the EU–US Data
          Privacy Framework or standard contractual clauses.
        </p>
      </Section>

      <Section heading="How long">
        <p>
          Subscriptions last until you unsubscribe — every message has a link,
          and using it deletes your row rather than flagging it. Applications
          are kept while they are being considered and for a year after, so we
          do not ask twice. Membership records are kept for as long as tax law
          requires us to keep the invoice, which in Germany is ten years.
          Sign-in links expire after fifteen minutes and can be used once.
        </p>
      </Section>

      <Section heading="Your rights">
        <p>
          Under the GDPR you can ask what we hold about you, have it corrected,
          have it deleted, take it elsewhere, or object to it being processed at
          all. Write to{" "}
          <TextLink href={`mailto:${OPERATOR.email}`}>
            {OPERATOR.email}
          </TextLink>{" "}
          and you will get an answer within a month, usually much sooner. Given
          how little is held, most requests can be answered in a sentence.
        </p>
        <p>
          You may also complain to a supervisory authority — for us that is the
          data protection authority of our federal state.
        </p>
      </Section>
    </LegalPage>
  );
}
