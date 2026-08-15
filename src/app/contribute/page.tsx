import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentContributor } from "@/lib/auth/session";
import { ContributeShell } from "./ContributeShell";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = {
  title: "Contribute — the beauty of earth.",
  robots: { index: false },
};

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

const ERRORS: Record<string, string> = {
  expired: "That link has expired or was already used. Here is a fresh one.",
};

export default async function ContributePage({ searchParams }: PageProps) {
  if (await getCurrentContributor()) {
    redirect("/contribute/photos");
  }

  const { error } = await searchParams;
  const notice = error === undefined ? undefined : ERRORS[error];

  return (
    <ContributeShell
      subtitle="This gallery is open to invited photographers. Sign in with the address your invitation was sent to."
      title="Contribute"
    >
      {notice === undefined ? null : (
        <p className="mb-6 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/80">
          {notice}
        </p>
      )}
      <SignInForm />
    </ContributeShell>
  );
}
