import type { Metadata } from "next";
import { LegalPage, Section } from "@/app/legal/LegalPage";
import { OPERATOR } from "@/lib/legal";
import { alternates } from "@/lib/metadata";

export const metadata: Metadata = {
  title: "Imprint — the beauty of earth.",
  description: "Who operates this site, as required by §5 DDG.",
  alternates: alternates("/imprint"),
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
      updated="17 August 2026"
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

      {/*
        One sentence, and it used to be two.

        The first pointed at the European Commission's online dispute
        resolution platform. That platform was switched off on 20 July 2025
        when Regulation (EU) 2024/3228 repealed Regulation (EU) No 524/2013,
        and the duty to link to it went with it — German guidance is that the
        reference must be *removed* rather than reworded, because a live
        assertion that a dead platform exists misleads a consumer about where
        they can complain, and is actionable on exactly that ground.

        What survives is national law, not the repealed regulation: §36 VSBG
        still requires a trader to say whether they will take part in
        proceedings before a Verbraucherschlichtungsstelle. So the second
        sentence stays, unchanged.
      */}
      <Section heading="Dispute resolution">
        <p>
          We are neither obliged nor willing to take part in dispute resolution
          proceedings before a consumer arbitration board, and would much rather
          you simply wrote to us.
        </p>
      </Section>
    </LegalPage>
  );
}
