import type { Metadata } from "next";
import { confirmAction } from "@/app/subscribe/actions";
import { StatusPage } from "@/components/StatusPage";
import { GlassButton } from "@/components/ui/glass-button";
import { TextLink } from "@/components/ui/TextLink";

export const metadata: Metadata = {
  title: "Confirm — the beauty of earth.",
  robots: { index: false },
};

/**
 * Where the confirmation link lands.
 *
 * A page rather than a route handler because there is something to say
 * either way, and because the person arriving here clicked a link in an
 * email and deserves more than a redirect. Not indexed: every URL that
 * reaches it carries a single-use token.
 *
 * Confirming must happen on POST. Mail gateways fetch the URL on the
 * recipient's behalf, so confirming while rendering the GET would make the
 * record of consent a scanner rather than a person — which is the whole
 * point of double opt-in and the basis the privacy policy claims — and would
 * spend the token, so the real click would land on "that link didn't work"
 * at the moment it had actually worked. Scanners do not POST.
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; state?: string }>;
}) {
  const { token, state } = await searchParams;

  if (state === "done") {
    return (
      <StatusPage
        detail="You will hear from us when new photographs are published. Every message carries a one-tap link to stop, including the one just sent."
        title="You're following"
        tone="done"
      />
    );
  }

  if (state === "unknown" || token === undefined || token === "") {
    return (
      <StatusPage
        /*
         * The sentence names the next step, so the page has to offer it.
         * Telling somebody at a dead end where to go and then leaving them
         * to find it is the worst of both.
         */
        action={<TextLink href="/subscribe">Send a fresh link</TextLink>}
        detail="That confirmation link has expired or was already used. Asking again from the follow page will send a fresh one."
        title="That link didn't work"
      />
    );
  }

  return (
    <StatusPage
      action={
        <form action={confirmAction}>
          <input name="token" type="hidden" value={token} />
          <GlassButton type="submit" variant="primary">
            Yes, follow the gallery
          </GlassButton>
        </form>
      }
      detail="One press and you are on the list. We send one message when new photographs go up, and nothing else — with a one-tap link to stop in every one."
      title="One more tap"
    />
  );
}
