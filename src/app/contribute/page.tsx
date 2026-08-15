import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Notice } from "@/components/ui/Notice";
import { getCurrentContributor } from "@/lib/auth/session";
import { ContributeCard } from "./ContributeShell";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = {
  title: "Contribute — the beauty of earth.",
  robots: { index: false },
};

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

/*
 * "Here is a fresh one" was a lie. Nothing is sent by landing here — the
 * person still has to ask, which is the entire next step and the message
 * described it as already done. A sign-in that quietly does not happen is
 * exactly how somebody concludes the site is broken.
 */
const ERRORS: Record<string, string> = {
  expired:
    "That sign-in link has expired or was already used. They last fifteen minutes and work once. Ask for another below.",
};

export default async function ContributePage({ searchParams }: PageProps) {
  if (await getCurrentContributor()) {
    redirect("/contribute/photos");
  }

  const { error } = await searchParams;
  const notice = error === undefined ? undefined : ERRORS[error];

  return (
    <ContributeCard
      subtitle="This gallery is open to invited photographers. Sign in with the address your invitation was sent to."
      title="Contribute"
    >
      {notice === undefined ? null : (
        <Notice className="mb-6" tone="warning">
          {notice}
        </Notice>
      )}
      <SignInForm />
    </ContributeCard>
  );
}
