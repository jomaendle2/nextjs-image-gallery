import type { Metadata } from "next";
import Link from "next/link";
import { confirm } from "@/app/subscribe/actions";
import { StatusPage } from "@/components/StatusPage";
import { TOUCH_LINK } from "@/components/ui/field";

export const metadata: Metadata = {
  title: "Subscription confirmed — the beauty of earth.",
  robots: { index: false },
};

/**
 * Where the confirmation link lands.
 *
 * A page rather than a route handler because there is something to say
 * either way, and because the person arriving here clicked a link in an
 * email and deserves more than a redirect. Not indexed: every URL that
 * reaches it carries a single-use token.
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const confirmed = token === undefined ? false : await confirm(token);

  return confirmed ? (
    <StatusPage
      detail="You will hear from us when new photographs are published. There is an unsubscribe link in every message, including the one just sent."
      title="You're subscribed"
    />
  ) : (
    <StatusPage
      /*
       * The sentence names the next step, so the page has to offer it.
       * Telling somebody at a dead end where to go and then leaving them to
       * find it is the worst of both.
       */
      action={
        <Link
          className={`${TOUCH_LINK} font-medium text-sm text-white/70 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white hover:decoration-white/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80`}
          href="/subscribe"
        >
          Send a fresh link
        </Link>
      }
      detail="That confirmation link has expired or was already used. Asking again from the follow page will send a fresh one."
      title="That link didn't work"
    />
  );
}
