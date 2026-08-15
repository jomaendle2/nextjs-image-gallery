import type { Metadata } from "next";
import { LegalPage, Section } from "@/app/legal/LegalPage";
import { OPERATOR } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Imprint — the beauty of earth.",
  description: "Who operates this site, as required by §5 DDG.",
  alternates: { canonical: "/imprint" },
};

/**
 * The Impressum, at an English URL.
 *
 * German law requires the notice to be easy to find and permanently
 * available; it does not prescribe the word or the language, and every other
 * page of this site is in English. "Imprint" is what an English-speaking
 * reader will look for, and the German heading appears beside it so somebody
 * looking for an Impressum recognises it as one.
 */
export default function ImprintPage() {
  return (
    <LegalPage
      subtitle="Angaben gemäß §5 DDG."
      title="Imprint"
      updated="15 August 2026"
    >
      <Section heading="Operator">
        <address className="whitespace-pre-line not-italic">
          {[OPERATOR.name, OPERATOR.street, OPERATOR.city, OPERATOR.country]
            .filter((line) => line !== "")
            .join("\n")}
        </address>
        <p>
          Email:{" "}
          <a
            className="underline decoration-white/25 underline-offset-4 transition-colors hover:text-white"
            href={`mailto:${OPERATOR.email}`}
          >
            {OPERATOR.email}
          </a>
        </p>
      </Section>

      <Section heading="Responsible for content">
        <p>
          {OPERATOR.name}, at the address above. Responsible under §18(2) MStV
          for the editorial content of this site.
        </p>
      </Section>

      <Section heading="VAT">
        {OPERATOR.vatId === "" ? (
          <p>
            No VAT identification number has been issued. Under §19 UStG
            (Kleinunternehmerregelung) no VAT is charged and none is shown on
            invoices.
          </p>
        ) : (
          <p>VAT identification number under §27a UStG: {OPERATOR.vatId}</p>
        )}
      </Section>

      <Section heading="Photographs">
        <p>
          Every photograph on this site belongs to the photographer credited
          beneath it. They are shown here with permission and are not licensed
          for reuse — a membership buys you a description of where a photograph
          was taken, never a right to the photograph itself. To license one,
          write to the photographer.
        </p>
      </Section>

      <Section heading="Dispute resolution">
        <p>
          The European Commission provides a platform for online dispute
          resolution at{" "}
          <a
            className="underline decoration-white/25 underline-offset-4 transition-colors hover:text-white"
            href="https://ec.europa.eu/consumers/odr/"
            rel="noopener noreferrer"
            target="_blank"
          >
            ec.europa.eu/consumers/odr
          </a>
          . We are neither obliged nor willing to take part in dispute
          resolution proceedings before a consumer arbitration board, and would
          much rather you simply wrote to us.
        </p>
      </Section>
    </LegalPage>
  );
}
