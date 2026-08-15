/**
 * Sends one of every message this site can send.
 *
 * There are six templates and they are the only part of the product that
 * reaches somebody outside the browser, which makes them the part where a
 * mistake is least recoverable: a broken link in an announcement goes to the
 * whole list at once and cannot be edited afterwards. This walks all six so
 * they can be read in a real client, on a real phone, before that happens.
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
  sendLoginEmail,
  sendNewWorkAnnouncement,
  sendSubscribeConfirmation,
  sendSubscribeWelcome,
} from "../src/lib/auth/email.ts";
import { sql } from "../src/lib/database.ts";
import { toGalleryImage } from "../src/lib/photos/map.ts";

const [, , to] = process.argv;
if (to === undefined) {
  console.error("Usage: smoke-email.mts <address>");
  process.exit(1);
}

const origin = process.env["NEXT_PUBLIC_SITE_URL"] ?? "http://localhost:3000";
const live =
  process.env["RESEND_API_KEY"] !== undefined &&
  process.env["EMAIL_FROM"] !== undefined;

console.log(
  live
    ? `Sending six messages to ${to} through Resend.\n`
    : "No RESEND_API_KEY / EMAIL_FROM — printing instead of sending.\n" +
        "This is the same fallback the dev server uses.\n",
);

/*
 * Real photographs, so the links in the announcement resolve. Two is enough
 * to show the layout repeating without filling an inbox.
 */
const photos = (await sql`
  SELECT p.id, COALESCE(p.display_url, p.blob_url) AS blob_url,
         p.title, p.description, p.location,
         c.display_name AS author_name, c.slug AS author_slug
  FROM photos p JOIN contributors c ON c.id = p.author_id
  WHERE p.published_at IS NOT NULL
  ORDER BY p.published_at DESC LIMIT 2;
`) as never[];

let failures = 0;

/*
 * Sequential on purpose: six messages arriving in a guaranteed order are far
 * easier to check off against this list than six racing into an inbox.
 */
async function step(label: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
    console.log(`  ok   ${label}`);
  } catch (error) {
    console.log(`  FAIL ${label}`);
    console.log(`       ${error instanceof Error ? error.message : error}`);
    failures += 1;
  }
}

await step("sign-in link", () =>
  sendLoginEmail(to, `${origin}/contribute/verify?token=smoke-test-token`),
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

console.log(
  failures === 0
    ? `\nall six ${live ? "sent" : "rendered"}`
    : `\n${failures} FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
