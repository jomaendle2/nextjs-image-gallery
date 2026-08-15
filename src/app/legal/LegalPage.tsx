import type { ReactNode } from "react";
import { ContributeShell } from "@/app/contribute/ContributeShell";
import { Notice } from "@/components/ui/Notice";
import { legalIsComplete, OPERATOR } from "@/lib/legal";

/**
 * The frame the three legal notices share.
 *
 * Reuses `ContributeShell` rather than inventing a fourth layout: these are
 * documents that scroll, exactly like the contributor pages, and a legal
 * notice that looks like a different site is the last place to introduce
 * doubt about who you are dealing with.
 *
 * The unfinished banner is the point of the component. An Impressum missing
 * its address is not a smaller Impressum, it is a broken one, and the
 * failure has to be visible to the operator rather than silent to the
 * reader.
 */
export function LegalPage({
  title,
  subtitle,
  updated,
  children,
}: {
  title: string;
  subtitle: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <ContributeShell subtitle={subtitle} title={title}>
      {legalIsComplete() ? null : (
        <Notice className="mb-8 max-w-prose" tone="warning">
          <strong className="font-semibold">Unfinished.</strong> The operator's
          postal address has not been filled in, so this notice does not yet
          meet §5 DDG. Set <code className="text-amber-100">street</code> and{" "}
          <code className="text-amber-100">city</code> in{" "}
          <code className="text-amber-100">src/lib/legal.ts</code> before taking
          real payments.
        </Notice>
      )}

      <div className="max-w-prose space-y-8 text-[0.9375rem] text-white/65 leading-relaxed">
        {children}

        <p className="border-white/10 border-t pt-6 text-sm text-white/40">
          Last updated {updated}. Questions about any of this go to{" "}
          <a
            className="underline decoration-white/25 underline-offset-4 transition-colors hover:text-white/70"
            href={`mailto:${OPERATOR.email}`}
          >
            {OPERATOR.email}
          </a>
          .
        </p>
      </div>
    </ContributeShell>
  );
}

/** A titled section, so the three documents share one heading rhythm. */
export function Section({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-[1.0625rem] text-white tracking-[-0.02em]">
        {heading}
      </h2>
      {children}
    </section>
  );
}
