import type { Metadata } from "next";
import { confirm } from "@/app/subscribe/actions";
import { StatusPage } from "@/components/StatusPage";

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
      detail="That confirmation link has expired or was already used. Asking again from the follow page will send a fresh one."
      title="That link didn't work"
    />
  );
}
