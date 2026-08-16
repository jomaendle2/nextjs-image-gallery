import type { Metadata } from "next";
import { TextLink } from "@/components/ui/TextLink";
import { ContributeShell } from "../ContributeShell";
import { ApplyForm } from "./ApplyForm";
import { WhatYouGet } from "./WhatYouGet";

export const metadata: Metadata = {
  title: "Apply to contribute — the beauty of earth.",
  description:
    "The gallery is open to invited photographers. Show us your work.",
};

export default function ApplyPage() {
  return (
    <ContributeShell
      back={{ href: "/contribute", label: "Sign in" }}
      subtitle="The gallery is small and invited on purpose. If your work belongs here, show us — four fields, no account to create."
      title="Apply to contribute"
    >
      <WhatYouGet />

      <ApplyForm />

      <p className="mt-8 text-sm text-white/45">
        Already invited?{" "}
        <TextLink href="/contribute" standalone={true}>
          Sign in
        </TextLink>
      </p>
    </ContributeShell>
  );
}
