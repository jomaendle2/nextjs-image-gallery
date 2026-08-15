import type { Metadata } from "next";
import Link from "next/link";
import { ContributeShell } from "@/app/contribute/ContributeShell";
import { TOUCH_LINK } from "@/components/ui/field";
import { getCurrentMember, getSessionEmail } from "@/lib/auth/session";
import { membershipConfigured } from "@/lib/stripe";
import { SubscribeButton } from "./SubscribeButton";

export const metadata: Metadata = {
  title: "Membership — the beauty of earth.",
  description:
    "See exactly where each photograph was taken, and how it was made.",
  alternates: { canonical: "/membership" },
};

/**
 * What a membership is, and the way in.
 *
 * Dynamic by necessity — it reads the session to know whether to offer
 * checkout, a thank-you, or a sign-in prompt. That is fine here and would
 * not be on the gallery, which is why the member gate on a photograph is a
 * separate request rather than a prop threaded through a cached page.
 */
export default async function MembershipPage() {
  const [email, member] = await Promise.all([
    getSessionEmail(),
    getCurrentMember(),
  ]);

  if (!membershipConfigured()) {
    return (
      <ContributeShell subtitle="Not open yet." title="Membership">
        <p className="max-w-prose text-sm text-white/55">
          Memberships are not on sale at the moment. The gallery itself stays
          free either way.
        </p>
      </ContributeShell>
    );
  }

  return (
    <ContributeShell
      subtitle="See exactly where each photograph was taken, and how it was made."
      title="Membership"
    >
      <div className="max-w-prose space-y-8">
        {member === null ? null : (
          <p className="glass-hairline rounded-2xl px-4 py-3 text-sm text-white/70">
            You are a member. The location and the notes appear under every
            photograph.
          </p>
        )}

        <section>
          <h2 className="font-medium text-[0.6875rem] text-white/40 uppercase tracking-[0.14em]">
            What you get
          </h2>
          <ul className="mt-4 space-y-4">
            <li>
              <h3 className="font-semibold text-[0.9375rem] text-white tracking-[-0.02em]">
                Where it was taken
              </h3>
              <p className="mt-1.5 text-pretty text-[0.8125rem] text-white/50 leading-relaxed">
                Not a region — the spot. Written by the photographer, for the
                photographs they choose to share it for. Nothing is read from
                the file: this gallery never records coordinates, and that has
                not changed.
              </p>
            </li>
            <li>
              <h3 className="font-semibold text-[0.9375rem] text-white tracking-[-0.02em]">
                How it was made
              </h3>
              <p className="mt-1.5 text-pretty text-[0.8125rem] text-white/50 leading-relaxed">
                The exposure is on every photograph already. This is the rest —
                the hour, the wait, what they would do differently.
              </p>
            </li>
          </ul>
        </section>

        {member === null ? (
          <SubscribeSection signedIn={email !== null} />
        ) : null}

        <p className="text-sm text-white/45">
          The gallery, the feeds and the photographs stay free and always will.
          A membership buys the things only the photographer can tell you.
        </p>
      </div>
    </ContributeShell>
  );
}

function SubscribeSection({ signedIn }: { signedIn: boolean }) {
  return (
    <section>
      <SubscribeButton signedIn={signedIn} />
      {signedIn ? null : (
        <p className="mt-3 text-sm text-white/45">
          <Link
            className={`${TOUCH_LINK} text-white/70 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white hover:decoration-white/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80`}
            href="/contribute"
          >
            Sign in
          </Link>{" "}
          and come back — it takes one email.
        </p>
      )}
    </section>
  );
}
