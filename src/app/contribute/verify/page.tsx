import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { completeSignIn } from "@/app/contribute/actions";
import { ContributeCard } from "@/app/contribute/ContributeShell";
import { GlassButton } from "@/components/ui/glass-button";

export const metadata: Metadata = {
  title: "Sign in — the beauty of earth.",
  robots: { index: false },
};

/**
 * Where a magic link lands.
 *
 * This was a route handler that consumed the token while serving the GET,
 * which meant anything following links in the mail path — SafeLinks,
 * Proofpoint, a preview pane — spent it before the recipient clicked.
 * The genuine click then landed on "that link has expired", identical to a
 * stale one, and nobody behind a corporate gateway could reliably sign in.
 *
 * One button, and the token is only spent when a person presses it. The
 * page says nothing about whether the token is valid — it cannot, without
 * checking, and checking is what spends it — so the wording promises
 * nothing it might not deliver.
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  /*
   * No token at all is not a failed sign-in, it is somebody who arrived
   * here by hand. Send them to the form rather than showing a button that
   * cannot work.
   */
  if (token === undefined || token === "") {
    redirect("/contribute?error=expired");
  }

  return (
    <ContributeCard
      subtitle="One press and you are in. The link works once."
      title="Finish signing in"
    >
      <form action={completeSignIn}>
        <input name="token" type="hidden" value={token} />
        <GlassButton className="w-full" type="submit">
          Sign in
        </GlassButton>
      </form>
    </ContributeCard>
  );
}
