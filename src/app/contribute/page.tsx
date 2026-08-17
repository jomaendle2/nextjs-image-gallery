import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Notice } from "@/components/ui/Notice";
import { getCurrentContributor, memberForSession } from "@/lib/auth/session";
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
    "That sign-in link has expired or was already used. Sign-in links work once and last an hour; an invitation lasts a week. Ask for another below.",
  /*
   * Reached from `/contribute/verify` with no token — somebody who typed the
   * URL, or whose mail client stripped the query string. They are not
   * recovering from a spent link, so telling them one expired invents a
   * failure they did not have.
   */
  nolink:
    "That link had nothing in it. Ask for a fresh one below and it will arrive in a moment.",
  /*
   * A session that ran out. `/contribute/*` used to redirect here silently, so
   * the page simply reappeared as if the site had forgotten them — which,
   * from the outside, is exactly what it looked like.
   */
  ended:
    "You were signed out because your session ran out. Signing in again takes one email.",
};

export default async function ContributePage({ searchParams }: PageProps) {
  /*
   * Both capabilities, because this door serves both and used to check only
   * one. A member with a live thirty-day session was shown the sign-in form
   * again with no acknowledgement that they were already signed in — so the
   * page's own subtitle said "for photographers and for members" while
   * treating one of them as a stranger. Asking for another link worked and
   * landed them back on `/membership`, which is where they should have been
   * sent in the first place.
   */
  const [contributor, member] = await Promise.all([
    getCurrentContributor(),
    memberForSession(),
  ]);
  if (contributor !== null) {
    redirect("/contribute/photos");
  }
  if (member !== null) {
    redirect("/membership");
  }

  const { error } = await searchParams;
  const notice = error === undefined ? undefined : ERRORS[error];

  return (
    <ContributeCard
      /*
       * Two audiences, one door. This used to read "open to invited
       * photographers… the address your invitation was sent to", which is
       * the page every member is sent to after paying — so somebody who had
       * bought a membership and never been invited to anything read it and
       * reasonably concluded they were in the wrong place.
       */
      subtitle="For photographers and for members. Sign in with your email address — no password, no account to create."
      title="Sign in"
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
