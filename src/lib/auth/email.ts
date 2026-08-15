import process from "node:process";
import { siteOrigin } from "@/lib/site-url";

/**
 * One seam for outbound mail.
 *
 * Provider is Resend, which supplies `RESEND_API_KEY`. Its REST API is a
 * POST with four fields, so there is no SDK dependency to carry.
 *
 * Without a key — local development, or before the provider is configured —
 * the message is printed to the server console instead. The whole flow is
 * therefore exercisable with nothing provisioned, and the fallback is loud
 * rather than silent.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

const HTML_SPECIALS = /[&<>"']/g;

const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Escape a value before it is interpolated into an email template.
 *
 * `displayName` reaches `sendApplicationApproved` from the public apply form,
 * so it is attacker-controlled: without this, `<img src=x onerror=…>` in a name
 * is live markup by the time the applicant opens the mail. The blast radius is
 * small — the message only ever goes to the address that submitted it — but a
 * template that interpolates unescaped input is a habit rather than a one-off,
 * so the escape lives at the seam and every interpolation goes through it.
 *
 * Both quote styles are covered because `button()` interpolates into an
 * attribute, not only into text.
 */
export function escapeHtml(value: string): string {
  return value.replace(HTML_SPECIALS, (character) => {
    const entity = HTML_ENTITIES[character];
    return entity === undefined ? character : entity;
  });
}

interface Message {
  to: string;
  subject: string;
  text: string;
  html: string;
}

function page(body: string): string {
  return `<!doctype html>
<html lang="en"><body style="margin:0;padding:32px;background:#0b0e12;font-family:ui-sans-serif,system-ui,sans-serif;color:#e8eaed">
  <h1 style="margin:0 0 16px;font-size:20px;letter-spacing:-0.03em">the beauty of earth.</h1>
  ${body}
</body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:0 0 24px">
    <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#e8eaed;color:#0b0e12;text-decoration:none;font-weight:600">${escapeHtml(label)}</a>
  </p>`;
}

async function send({ to, subject, text, html }: Message): Promise<void> {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["EMAIL_FROM"];

  if (apiKey === undefined || from === undefined) {
    console.warn(`\n  [no email provider configured] to ${to}: ${subject}\n`);
    console.warn(`${text}\n`);
    return;
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, text, html }),
  });

  if (!response.ok) {
    throw new Error(
      `Email provider rejected the request: ${response.status} ${await response.text()}`,
    );
  }
}

export async function sendLoginEmail(to: string, url: string): Promise<void> {
  await send({
    to,
    subject: "Your sign-in link",
    text: [
      "Sign in to the beauty of earth.",
      "",
      url,
      "",
      "This link works once and expires in 15 minutes.",
      "If you did not ask for it, you can ignore this email.",
    ].join("\n"),
    html: page(
      `<p style="margin:0 0 24px;color:#a8adb4;line-height:1.6">
         Here is your sign-in link. It works once and expires in 15 minutes.
       </p>
       ${button(url, "Sign in")}
       <p style="margin:0;color:#6b7178;font-size:13px;line-height:1.6">
         If you did not ask for this, you can ignore it.
       </p>`,
    ),
  });
}

export async function sendApplicationApproved(
  to: string,
  displayName: string,
): Promise<void> {
  const url = `${siteOrigin()}/contribute`;
  const name = escapeHtml(displayName);

  await send({
    to,
    subject: "You're in — the beauty of earth.",
    text: [
      `${displayName}, your work is a fit. Welcome.`,
      "",
      `Sign in with this address to publish your first photograph: ${url}`,
      "",
      "Upload the full-size original; the gallery handles the rest.",
    ].join("\n"),
    html: page(
      `<p style="margin:0 0 24px;color:#a8adb4;line-height:1.6">
         ${name}, your work is a fit. Welcome.
       </p>
       ${button(url, "Publish your first photograph")}
       <p style="margin:0;color:#6b7178;font-size:13px;line-height:1.6">
         Sign in with this address. Upload the full-size original — the gallery
         handles the rest.
       </p>`,
    ),
  });
}

/**
 * The "new work is up" message, to one subscriber.
 *
 * The body is built by `lib/announcement.ts` and passed in already
 * assembled, so the escaping can be tested without a mail provider — see
 * the note there. This function's only job is delivery.
 */
export async function sendNewWorkAnnouncement(
  to: string,
  message: { subject: string; text: string; html: string },
): Promise<void> {
  await send({
    to,
    subject: message.subject,
    text: message.text,
    html: page(message.html),
  });
}

/**
 * Tells the owner there is something worth announcing.
 *
 * Sent by the weekly cron, and deliberately not to the list: the cron
 * prompts, a person decides. Nothing reaches a subscriber without somebody
 * pressing a button.
 */
export async function sendAnnouncementReminder(
  to: string,
  count: number,
): Promise<void> {
  const url = `${siteOrigin()}/contribute/admin`;
  const noun = count === 1 ? "photograph" : "photographs";

  await send({
    to,
    subject: `${count} ${noun} waiting to be announced`,
    text: [
      `${count} ${noun} have been published since the last announcement.`,
      "",
      `Send it, or leave it for next week: ${url}`,
    ].join("\n"),
    html: page(
      `<p style="margin:0 0 24px;color:#a8adb4;line-height:1.6">
         ${count} ${noun} have been published since the last announcement.
       </p>
       ${button(url, "Review and send")}
       <p style="margin:0;color:#6b7178;font-size:13px;line-height:1.6">
         Nothing goes out until you press send.
       </p>`,
    ),
  });
}

/**
 * The one message an unconfirmed address is ever sent.
 *
 * Deliberately plain about what happened and what to do if it was not them.
 * The address in the "to" line is the only evidence we have that whoever
 * typed it owns it, and until this link comes back we assume they do not.
 */
export async function sendSubscribeConfirmation(
  to: string,
  url: string,
): Promise<void> {
  await send({
    to,
    subject: "Confirm your subscription",
    text: [
      "Someone asked to hear when new photographs are published on",
      "the beauty of earth. If that was you, confirm here:",
      "",
      url,
      "",
      "The link expires in a day. If it was not you, ignore this —",
      "nothing will be sent to this address.",
    ].join("\n"),
    html: page(
      `<p style="margin:0 0 24px;color:#a8adb4;line-height:1.6">
         Someone asked to hear when new photographs are published. If that was
         you, confirm below — the link expires in a day.
       </p>
       ${button(url, "Confirm subscription")}
       <p style="margin:0;color:#6b7178;font-size:13px;line-height:1.6">
         If it was not you, ignore this. Nothing will be sent to this address.
       </p>`,
    ),
  });
}

/**
 * Sent once, on confirmation, carrying the unsubscribe link.
 *
 * That link is here as well as in every later message, because the moment
 * somebody most wants a way out is the moment they realise they did not mean
 * to sign up at all.
 */
export async function sendSubscribeWelcome(
  to: string,
  unsubscribeUrl: string,
): Promise<void> {
  const gallery = siteOrigin();

  await send({
    to,
    subject: "You're subscribed — the beauty of earth.",
    text: [
      "You will hear from us when new photographs are published.",
      "Not often, and never for anything else.",
      "",
      gallery,
      "",
      `Unsubscribe at any time: ${unsubscribeUrl}`,
    ].join("\n"),
    html: page(
      `<p style="margin:0 0 24px;color:#a8adb4;line-height:1.6">
         You will hear from us when new photographs are published. Not often,
         and never for anything else.
       </p>
       ${button(gallery, "See the gallery")}
       <p style="margin:0;color:#6b7178;font-size:13px;line-height:1.6">
         <a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b7178">Unsubscribe</a>
         at any time.
       </p>`,
    ),
  });
}
