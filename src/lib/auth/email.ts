import process from "node:process";
import { count } from "@/lib/plural";
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
    /*
     * Printing the message is a development convenience and a production
     * incident. The body of a sign-in email *is* a valid credential for the
     * next fifteen minutes, so writing it to a platform log hands anybody
     * with log access a way into any account that asks for a link — and the
     * person waiting is told "check your inbox" while nothing was sent.
     *
     * So in production this is a failure, loudly. Throwing surfaces it to
     * the caller, which already knows how to show an error, rather than
     * letting the site quietly stop being able to sign anybody in.
     */
    if (process.env["NODE_ENV"] === "production") {
      throw new Error(
        "Email is not configured: set RESEND_API_KEY and EMAIL_FROM.",
      );
    }
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

/**
 * Tells somebody they have been invited.
 *
 * Approving an application sent mail; inviting somebody directly did not, so
 * the owner had to message each person separately to say the thing the site
 * could have said itself. With five photographers that is five out-of-band
 * conversations and five chances for somebody never to arrive.
 *
 * Separate from `sendApplicationApproved` because the two are not the same
 * event. "Your work is a fit" answers a submission; an invitation arrives
 * unasked, and should say what it is rather than congratulate somebody on an
 * application they never sent.
 */
export async function sendInvitation(
  to: string,
  displayName: string,
  invitedByName?: string,
): Promise<void> {
  const url = `${siteOrigin()}/contribute`;
  const name = escapeHtml(displayName);

  /*
   * Who sent it, when a photographer rather than the owner did.
   *
   * An invitation from a peer that does not name the peer reads as spam: an
   * unsolicited message telling a stranger they have been chosen, by nobody
   * in particular. Naming the person makes it the thing it actually is, and
   * it is the whole reason a peer invite is worth more than a form. Optional,
   * so the owner's own invite is unchanged and still speaks for the gallery.
   */
  const from = invitedByName?.trim() ?? "";
  const opening =
    from === ""
      ? `${displayName}, you have been invited to publish on the beauty of earth.`
      : `${displayName}, ${from} has invited you to publish on the beauty of earth.`;
  const openingHtml =
    from === ""
      ? `${name}, you have been invited to publish on the beauty of earth.`
      : `${name}, ${escapeHtml(from)} has invited you to publish on the beauty of earth.`;

  await send({
    to,
    subject: "An invitation — the beauty of earth.",
    text: [
      opening,
      "",
      `Sign in with this address — there is no password and nothing to accept: ${url}`,
      "",
      "Upload the full-size originals. The gallery reads the camera and",
      "exposure from the file and never opens the GPS block, so where you",
      "stood stays yours unless you choose to write it down.",
      "",
      "If you were not expecting this, ignore it — nothing happens until you",
      "sign in.",
    ].join("\n"),
    html: page(
      `<p style="margin:0 0 24px;color:#a8adb4;line-height:1.6">
         ${openingHtml}
       </p>
       ${button(url, "Sign in and add your work")}
       <p style="margin:0 0 16px;color:#6b7178;font-size:13px;line-height:1.6">
         Sign in with this address — there is no password and nothing to
         accept. Upload the full-size originals: the gallery reads the camera
         and exposure from the file and never opens the GPS block, so where
         you stood stays yours unless you choose to write it down.
       </p>
       <p style="margin:0;color:#6b7178;font-size:13px;line-height:1.6">
         If you were not expecting this, ignore it — nothing happens until you
         sign in.
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
 * What somebody gets for their five euros, in writing.
 *
 * There was no membership email at all. The only instruction lived on the
 * page Stripe redirects to, so anybody who closed the tab — or paid on a
 * phone and opened the site on a laptop — had paid and had nothing, anywhere,
 * telling them what they had bought or how to reach it. Checkout would then
 * refuse them a second time with "that address already has a membership",
 * which is true and useless.
 *
 * It carries a working sign-in link rather than instructions to request one,
 * because the moment after paying is exactly when a person should not be
 * asked to do more admin. The link is single-use and expires like any other;
 * the text says so, and says what to do when it has.
 */
export async function sendMembershipWelcome(
  to: string,
  signInUrl: string,
): Promise<void> {
  const origin = siteOrigin();

  await send({
    to,
    subject: "Your membership — the beauty of earth.",
    text: [
      "Thank you — your membership is active.",
      "",
      `Open this to sign in: ${signInUrl}`,
      "",
      "The link works once and lasts fifteen minutes. If it expires, ask for",
      `a fresh one at ${origin}/contribute using this same address.`,
      "",
      "Signed in, every photograph shows where it was taken and how, wherever",
      "the photographer has written it down.",
      "",
      `Cancel any time from ${origin}/membership. No notice period.`,
    ].join("\n"),
    html: page(
      `<p style="margin:0 0 24px;color:#a8adb4;line-height:1.6">
         Thank you — your membership is active.
       </p>
       ${button(signInUrl, "Sign in")}
       <p style="margin:0 0 16px;color:#6b7178;font-size:13px;line-height:1.6">
         The link works once and lasts fifteen minutes. If it expires, ask for
         a fresh one at
         <a href="${escapeHtml(`${origin}/contribute`)}" style="color:#a8adb4">${escapeHtml(`${origin}/contribute`)}</a>
         using this same address.
       </p>
       <p style="margin:0 0 16px;color:#6b7178;font-size:13px;line-height:1.6">
         Signed in, every photograph shows where it was taken and how,
         wherever the photographer has written it down.
       </p>
       <p style="margin:0;color:#6b7178;font-size:13px;line-height:1.6">
         Cancel any time from
         <a href="${escapeHtml(`${origin}/membership`)}" style="color:#6b7178">${escapeHtml(`${origin}/membership`)}</a>.
         No notice period.
       </p>`,
    ),
  });
}

/**
 * The answer nobody was getting.
 *
 * `/contribute/apply` says a reply "takes a few days rather than a few
 * minutes", and declining sent nothing at all — so an applicant who was not
 * a fit waited indefinitely for a message that had been promised and would
 * never arrive. A short no is a better thing to receive than silence, and it
 * is the only version of this that makes the form's promise true.
 *
 * Deliberately brief, and deliberately not a critique. The gallery is small
 * on purpose; that is a fact about the gallery rather than about their
 * photographs, and it is the honest reason in nearly every case.
 */
export async function sendApplicationDeclined(
  to: string,
  displayName: string,
): Promise<void> {
  const name = escapeHtml(displayName);

  await send({
    to,
    subject: "About your application — the beauty of earth.",
    text: [
      `${displayName}, thank you for showing us your work.`,
      "",
      "We are not able to add you to the gallery at the moment. It stays",
      "deliberately small, which means saying no to photographs we like.",
      "",
      "You are welcome to apply again later.",
    ].join("\n"),
    html: page(
      `<p style="margin:0 0 20px;color:#a8adb4;line-height:1.6">
         ${name}, thank you for showing us your work.
       </p>
       <p style="margin:0 0 20px;color:#a8adb4;line-height:1.6">
         We are not able to add you to the gallery at the moment. It stays
         deliberately small, which means saying no to photographs we like.
       </p>
       <p style="margin:0;color:#6b7178;font-size:13px;line-height:1.6">
         You are welcome to apply again later.
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
  waiting: number,
): Promise<void> {
  const url = `${siteOrigin()}/contribute/admin`;
  const phrase = count(waiting, "photograph");

  await send({
    to,
    subject: `${phrase} waiting to be announced`,
    text: [
      `${phrase} have been published since the last announcement.`,
      "",
      `Send it, or leave it for next week: ${url}`,
    ].join("\n"),
    html: page(
      `<p style="margin:0 0 24px;color:#a8adb4;line-height:1.6">
         ${phrase} have been published since the last announcement.
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
    subject: "Confirm — the beauty of earth.",
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
       ${button(url, "Yes, follow the gallery")}
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
    subject: "You're following — the beauty of earth.",
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
         <a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b7178">Stop following</a>
         at any time.
       </p>`,
    ),
  });
}
