/**
 * Sends one of every message this site can send.
 *
 * These are the only part of the product that reaches somebody outside the
 * browser, which makes them the part where a mistake is least recoverable: a
 * broken link in an announcement goes to the whole list at once and cannot be
 * edited afterwards. This walks every one of them so they can be read in a
 * real client, on a real phone, before that happens.
 *
 * Twelve messages from ten senders: the upload nudge is walked at three of its
 * six stages, because a sequence is only checkable as a sequence — whether
 * stage 6 really reads as the last one is a question about the messages
 * together rather than about any one of them — and the invitation is walked
 * twice, with a photograph and without, because that fallback is the one
 * thing about the redesign that reading the code cannot confirm.
 *
 * With `RESEND_API_KEY` and `EMAIL_FROM` set it really sends, to an address
 * given on the command line. Without them it prints the plain-text part,
 * which is exactly what the app itself does in development — so running it
 * either way exercises the same code path the site uses.
 *
 * Usage:
 *
 *   node --env-file=.env.local scripts/smoke-email.mts you@example.com
 *
 * Nothing here touches the database or the subscriber list. The announcement
 * is built from real published photographs so the links are real, but it is
 * addressed only to the address you pass.
 */
import process from "node:process";
import { buildAnnouncement } from "../src/lib/announcement.ts";
import {
  sendAnnouncementReminder,
  sendApplicationApproved,
  sendDraftNudge,
  sendInvitation,
  sendLoginEmail,
  sendUploadNudge,
} from "../src/lib/auth/email.ts";
import { sql } from "../src/lib/database.ts";
import { toGalleryImage } from "../src/lib/photos/map.ts";
import { siteOrigin } from "../src/lib/site-url.ts";
import {
  sendNewWorkAnnouncement,
  sendSubscribeConfirmation,
  sendSubscribeWelcome,
} from "../src/lib/subscribers/email.ts";
import { check, finish } from "./harness.mts";

const [, , to] = process.argv;
if (to === undefined) {
  console.error("Usage: smoke-email.mts <address>");
  process.exit(1);
}

// The app's own resolution, so a test message links where a real one would.
const origin = siteOrigin();
const live =
  process.env["RESEND_API_KEY"] !== undefined &&
  process.env["EMAIL_FROM"] !== undefined;

/*
 * Fixture links, assembled rather than written out: a literal `?token=…` in
 * source is what biome's `noSecrets` looks for, and it cannot tell a fixture
 * from a leak.
 */
const signIn = `${origin}/contribute/verify?${new URLSearchParams({ token: "smoke-test-token" })}`;
const quiet = `${origin}/contribute/quiet?${new URLSearchParams({ token: "smoke-test-token" })}`;

console.log(
  live
    ? `Sending twelve messages to ${to} through Resend.\n`
    : "No RESEND_API_KEY / EMAIL_FROM — printing instead of sending.\n" +
        "This is the same fallback the dev server uses.\n",
);

/*
 * Real photographs, so the links in the announcement resolve. Two is enough
 * to show the layout repeating without filling an inbox.
 */
const photos = (await sql`
  -- display_url is NOT NULL now; the coalesce that used to be here could
  -- serve the camera original, GPS and all. See repository.ts.
  SELECT p.id, p.display_url AS blob_url,
         p.title, p.description, p.location,
         c.display_name AS author_name, c.slug AS author_slug
  FROM photos p JOIN contributors c ON c.id = p.author_id
  WHERE p.published_at IS NOT NULL
  ORDER BY p.published_at DESC LIMIT 2;
`) as never[];

/*
 * Sequential on purpose: twelve messages arriving in a guaranteed order are
 * far easier to check off against this list than twelve racing into an inbox.
 *
 * A send has no boolean to assert on — it either returns or throws — so this
 * turns the throw into the harness's `check`.
 */
async function step(label: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
    check(label, true);
  } catch (error) {
    check(label, false, error instanceof Error ? error.message : String(error));
  }
}

await step("sign-in link", () =>
  sendLoginEmail(to, `${origin}/contribute/verify?token=smoke-test-token`),
);

/*
 * With a photograph and without, because the difference is the whole point of
 * the redesign and only one of the two can be checked by reading code.
 */
await step("invitation, with the photograph", () =>
  sendInvitation(to, {
    displayName: "Smoke Test",
    invitedByName: "Jo",
    signInUrl: signIn,
    showcase:
      photos[0] === undefined
        ? undefined
        : {
            url: (photos[0] as { blob_url: string }).blob_url,
            alt: "A photograph from the gallery.",
            caption: "From the gallery",
            href: origin,
          },
  }),
);

await step("invitation, with nothing published yet", () =>
  sendInvitation(to, { displayName: "Smoke Test" }),
);

await step("application approved", () =>
  sendApplicationApproved(to, "Smoke Test"),
);

await step("subscribe confirmation (double opt-in)", () =>
  sendSubscribeConfirmation(to, `${origin}/subscribe/confirm?token=smoke`),
);

await step("subscribe welcome", () =>
  sendSubscribeWelcome(to, `${origin}/subscribe/unsubscribe?token=smoke`),
);

await step("new work announcement", () =>
  sendNewWorkAnnouncement(
    to,
    buildAnnouncement(
      photos.map(toGalleryImage),
      origin,
      `${origin}/subscribe/unsubscribe?token=smoke`,
    ),
  ),
);

await step("weekly reminder to the owner", () =>
  sendAnnouncementReminder(to, photos.length),
);

/*
 * The nudges, at the three stages worth reading with your own eyes.
 *
 * Stage 1 is the one most people will ever see; stage 2 carries the objection
 * this whole sequence exists to answer; stage 6 has to read unmistakably as
 * the last message rather than as another reminder. Check the opt-out link in
 * each — it is the one link in these mails that has to work even when
 * everything else about them has been ignored.
 */

for (const stage of [1, 2, 6]) {
  await step(`upload nudge, stage ${stage} of six`, () =>
    sendUploadNudge(to, {
      displayName: "Smoke Test",
      stage,
      signInUrl: signIn,
      quietUrl: quiet,
      hasSignedIn: stage > 1,
    }),
  );
}

await step("draft nudge, stage 1 of three", () =>
  sendDraftNudge(to, {
    displayName: "Smoke Test",
    stage: 1,
    drafts: 2,
    signInUrl: signIn,
    quietUrl: quiet,
  }),
);

finish();
