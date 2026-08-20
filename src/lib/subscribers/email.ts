import {
  block,
  button,
  escapeHtml,
  eyebrow,
  lead,
  MAIL,
  type MailPhoto,
  page,
  paragraph,
  photo,
  send,
} from "@/lib/auth/mailer";
import { siteOrigin } from "@/lib/site-url";

/**
 * The three messages that go to a mailing list rather than to a person.
 *
 * Split out of `auth/email.ts` when that file hit this project's ceiling on
 * length, and the seam is the right one rather than merely convenient: these
 * are the only messages addressed to somebody who is not a contributor, they
 * are the only ones that carry an unsubscribe by law rather than by courtesy,
 * and the announcement is the one message here that goes to everybody at once
 * and cannot be recalled.
 *
 * They render through the same kit as every other template — `mailer.ts` owns
 * the shell, the type and the one accent — so a subscriber's mail and a
 * photographer's are recognisably from the same gallery.
 */

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
      block(
        `${eyebrow("Confirm")}
         ${lead("Someone asked to hear when new photographs are published.")}
         ${paragraph("If that was you, confirm below. The link expires in a day.")}
         ${button(url, "Yes, follow the gallery")}`,
        "24px 28px 28px",
      ),
      {
        preheader: "One press, and only when there is new work.",
        footnote:
          "If it was not you, ignore this. Nothing will be sent to this address.",
      },
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
  /**
   * What they just signed up to see, shown rather than described.
   *
   * The same argument the invitation makes: this is the one message a new
   * subscriber gets before the announcements start, and it was a paragraph
   * promising photographs. Optional, for the same reason — nothing published
   * yet is a real state, and a broken image is worse than none.
   */
  showcase?: MailPhoto,
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
      `${showcase === undefined ? "" : photo(showcase)}
       ${block(
         `${eyebrow("Following")}
          ${lead("You will hear from us when new photographs are published.")}
          ${paragraph("Not often, and never for anything else.")}
          ${button(gallery, "See the gallery")}`,
         "24px 28px 28px",
       )}`,
      {
        preheader: "Not often, and never for anything else.",
        footnote: `<a href="${escapeHtml(unsubscribeUrl)}" style="color:${MAIL.faint}">Stop following</a> at any time.`,
      },
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
