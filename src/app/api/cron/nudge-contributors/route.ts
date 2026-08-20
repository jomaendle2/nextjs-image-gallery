import process from "node:process";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  claimNudge,
  ensureNudgeToken,
  listNudgeCandidates,
} from "@/lib/auth/contributors";
import { sendDraftNudge, sendUploadNudge } from "@/lib/auth/email";
import type { MailPhoto } from "@/lib/auth/mailer";
import { type PlannedNudge, planNudges } from "@/lib/auth/nudges";
import { invitationUrl } from "@/lib/auth/tokens";
import { latestShowcasePhoto } from "@/lib/photos/showcase";
import { siteOrigin } from "@/lib/site-url";

/**
 * The daily run that decides who, if anybody, hears from the gallery.
 *
 * Modelled on `announce-reminder`, and different from it in one way worth
 * stating: that one mails *the owner* and leaves the sending to a person,
 * because an announcement goes to everybody at once and cannot be recalled.
 * This one really does mail photographers — but each message goes to exactly
 * one address, is one of at most six that address will ever receive, and
 * carries its own way out. That is a different risk, and it earns a different
 * answer.
 *
 * Vercel calls it with `Authorization: Bearer $CRON_SECRET`. Without that
 * header this is a public URL that would let anyone burn somebody's whole
 * sequence in an afternoon, so the check is the first thing that happens.
 *
 * The decisions are not made here. `planNudges` is pure and lives in
 * `lib/auth/nudges.ts`; this file claims, mints and delivers, which is
 * everything that needs a database, a mail provider or a clock.
 */

/**
 * The most mail one run will send.
 *
 * Resend's default rate limit is low, and this is a `for` loop with an
 * `await` in it rather than a queue. The cap exists so a first production run
 * against a list that accumulated before the feature shipped cannot become a
 * burst. The overflow is warned about rather than dropped quietly, because a
 * silent truncation reads afterwards as "everybody was covered".
 */
const MAX_PER_RUN = 40;

type Outcome = "sent" | "skipped" | "failed";

/**
 * One nudge, from claim to delivery.
 *
 * Extracted so the loop below has no branches of its own: the two "do
 * nothing" exits are returns rather than `continue`s, and each is next to
 * the reason for it.
 */
async function deliver(
  one: PlannedNudge,
  origin: string,
  showcase: MailPhoto | undefined,
): Promise<Outcome> {
  /*
   * Claim first. The insert is the idempotency: if this stage was already
   * claimed — by a retry, by two overlapping runs, by a hand-run during an
   * incident — it returns false and nothing is sent.
   */
  const claimed = await claimNudge(one.id, one.track, one.stage);
  if (!claimed) {
    return "skipped";
  }

  /*
   * A fresh sign-in link every time, and this is the point of the whole
   * route. The original invitation's token is single-use and seven days old,
   * so a day-37 nudge carrying it would be a dead link — worse than no nudge,
   * because it teaches the reader that this gallery's mail does not work.
   */
  const [signInUrl, token] = await Promise.all([
    invitationUrl(one.email),
    ensureNudgeToken(one.id),
  ]);

  /*
   * No token, no send. The opt-out is not decoration: a nudge without a
   * working one is the message that earns a spam report, and a spam report
   * costs the domain rather than the address.
   */
  if (token === null) {
    console.error(`No nudge token for ${one.email}; sending nothing.`);
    return "failed";
  }

  const quietUrl = `${origin}/contribute/quiet?token=${encodeURIComponent(token)}`;

  if (one.track === "empty") {
    await sendUploadNudge(one.email, {
      displayName: one.displayName,
      stage: one.stage,
      signInUrl,
      quietUrl,
      hasSignedIn: one.hasSignedIn,
      showcase,
    });
  } else {
    await sendDraftNudge(one.email, {
      displayName: one.displayName,
      stage: one.stage,
      drafts: one.drafts,
      signInUrl,
      quietUrl,
      /*
       * Their own draft, when the query found one. An unpublished photograph
       * often has no description yet — that is the very thing this message
       * asks them to write — so the alt text says what it is rather than
       * pretending to describe it.
       */
      draft:
        one.draftUrl === null
          ? undefined
          : {
              url: one.draftUrl,
              alt:
                one.draftDescription === null || one.draftDescription === ""
                  ? "A photograph you have not published yet."
                  : one.draftDescription,
            },
    });
  }

  return "sent";
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const secret = process.env["CRON_SECRET"];
  if (secret === undefined || secret === "") {
    console.error("CRON_SECRET is not set; refusing to run the nudges.");
    return NextResponse.json({ error: "Not configured." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }

  const candidates = await listNudgeCandidates();
  const due = planNudges(candidates, new Date());
  const plan = due.slice(0, MAX_PER_RUN);

  if (due.length > plan.length) {
    console.warn(
      `${due.length} nudges due, sending ${plan.length} this run; ` +
        `${due.length - plan.length} deferred to tomorrow.`,
    );
  }

  /*
   * `?dry=1` computes the plan and returns it without claiming or sending —
   * still behind the bearer check, because the plan is a list of addresses.
   * This is how the first production run gets inspected: read who would be
   * mailed, against the real database, before the 09:00 cron ever fires.
   */
  if (request.nextUrl.searchParams.get("dry") === "1") {
    return NextResponse.json({
      dry: true,
      candidates: candidates.length,
      due: due.length,
      plan: plan.map((one) => ({
        email: one.email,
        track: one.track,
        stage: one.stage,
        drafts: one.drafts,
      })),
    });
  }

  const origin = siteOrigin();

  /*
   * One photograph for the whole run, fetched once.
   *
   * Only stage 3 of the empty track shows it — the message that says there is
   * new work here — so this is at most one extra query per run and often an
   * unused one. Per recipient it would be the same row fetched forty times.
   */
  const newest = await latestShowcasePhoto();
  const showcase: MailPhoto | undefined =
    newest === null
      ? undefined
      : {
          url: newest.display_url,
          alt: newest.description,
          caption: `${newest.title === "" ? "Untitled" : newest.title} — ${newest.author_name}`,
          href: `${origin}/photo/${newest.id}`,
        };

  const tally: Record<Outcome, number> = { sent: 0, skipped: 0, failed: 0 };

  for (const one of plan) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — a queue is kinder to the provider than a burst, and each claim must settle before the next send
      tally[await deliver(one, origin, showcase)] += 1;
    } catch (error) {
      /*
       * Per recipient, so one bad address does not end the run for everybody
       * behind it. The stage stays claimed, which means that person misses
       * this one message rather than receiving it twice tomorrow.
       */
      tally.failed += 1;
      console.error(`Nudge to ${one.email} failed:`, error);
    }
  }

  return NextResponse.json({
    candidates: candidates.length,
    due: due.length,
    ...tally,
  });
}
