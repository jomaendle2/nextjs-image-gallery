import process from "node:process";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { listContributors } from "@/lib/auth/contributors";
import { sendAnnouncementReminder } from "@/lib/auth/email";
import { isOwner } from "@/lib/auth/types";
import { listUnannouncedPhotos } from "@/lib/photos/repository";
import { listConfirmedSubscribers } from "@/lib/subscribers/repository";

/**
 * The weekly nudge.
 *
 * This route does not mail the subscriber list — it mails the owner to say
 * there is something worth sending, and the sending itself stays behind a
 * button on `/contribute/admin`. That is the whole difference between a
 * schedule and an automation: a wrong title or a photograph published by
 * accident reaches one person who can still stop it, rather than everybody.
 *
 * Vercel calls this with `Authorization: Bearer $CRON_SECRET`. Without that
 * header it is a public URL that would let anyone make the owner's inbox
 * ring, so the check is the first thing that happens.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const secret = process.env["CRON_SECRET"];
  if (secret === undefined || secret === "") {
    console.error("CRON_SECRET is not set; refusing to run the reminder.");
    return NextResponse.json({ error: "Not configured." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }

  const [pending, subscribers] = await Promise.all([
    listUnannouncedPhotos(),
    listConfirmedSubscribers(),
  ]);

  /*
   * Quiet weeks stay quiet. A reminder that nothing happened is the fastest
   * way to teach somebody to ignore the reminder — and with nobody
   * subscribed there is nothing to prompt about either.
   */
  if (pending.length === 0 || subscribers.length === 0) {
    return NextResponse.json({ pending: pending.length, reminded: false });
  }

  const owners = (await listContributors()).filter(
    (person) => isOwner(person) && person.revoked_at === null,
  );

  for (const owner of owners) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: at most a handful of owners, and a queue is kinder to the provider than a burst
      await sendAnnouncementReminder(owner.email, pending.length);
    } catch (error) {
      console.error(`Reminder to ${owner.email} failed:`, error);
    }
  }

  return NextResponse.json({ pending: pending.length, reminded: true });
}
