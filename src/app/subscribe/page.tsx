import type { Metadata } from "next";
import { ContributeShell } from "@/app/contribute/ContributeShell";
import { TextLink } from "@/components/ui/TextLink";
import { alternates } from "@/lib/metadata";
import { SubscribeForm } from "./SubscribeForm";

export const metadata: Metadata = {
  title: "Follow the gallery — the beauty of earth.",
  description:
    "Hear when new photographs are published. Not often, and never for anything else.",
  alternates: alternates("/subscribe"),
};

/**
 * The email half of following the gallery. `/feed.xml` is the other half,
 * and it is offered here too — a reader costs us nothing and asks nothing of
 * the person, which makes it the better option for anyone who has one.
 */
export default function SubscribePage() {
  return (
    <ContributeShell
      subtitle="Hear when new photographs are published. Not often, and never for anything else."
      title="Follow the gallery"
    >
      <div className="max-w-md">
        <SubscribeForm />

        <p className="mt-8 text-sm text-white/45">
          We send one message when new work goes up, and nothing else. Your
          address is confirmed before anything is sent, every message carries a
          one-tap link to stop, and stopping deletes the address rather than
          flagging it.
        </p>

        <p className="mt-4 text-sm text-white/45">
          Prefer a reader?{" "}
          <TextLink href="/feed.xml" standalone={true}>
            The feed is here
          </TextLink>
          , and each photographer has one of their own.
        </p>
      </div>
    </ContributeShell>
  );
}
