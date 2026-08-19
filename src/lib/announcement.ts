import type { GalleryImage } from "@/data/galleryData";
import { escapeHtml } from "@/lib/auth/mailer";
import { photoAltText } from "@/lib/photos/alt-text";
import { photoTitle } from "@/lib/photos/title";

/**
 * The body of the "new work" message, built away from the sending.
 *
 * Pure and separately testable for the same reason `feed.ts` is: every
 * value in here was typed by a contributor, and this text ends up inside an
 * HTML document in somebody else's mail client. The escaping is the whole
 * risk, and a function that also talks to a mail provider cannot be tested
 * for it cheaply.
 */

interface AnnouncementParts {
  subject: string;
  text: string;
  html: string;
}

/** Beyond this, the message is a catalogue rather than an invitation. */
export const ANNOUNCEMENT_LIMIT = 12;

function subjectFor(images: readonly GalleryImage[]): string {
  const count = images.length;
  const [first] = images;
  if (count === 1 && first) {
    const title = first.title.trim();
    return title === ""
      ? `A new photograph by ${first.author.name}`
      : `${title} — a new photograph by ${first.author.name}`;
  }
  return `${count} new photographs on the beauty of earth.`;
}

/**
 * Builds the parts of an announcement.
 *
 * `origin` and `unsubscribeUrl` are passed in rather than read from
 * configuration, so this can be tested without an environment and so the
 * unsubscribe link is unmistakably per recipient — it is the one part of
 * this message that differs between people, and making it a parameter is
 * what stops a shared link being built by accident.
 */
export function buildAnnouncement(
  images: readonly GalleryImage[],
  origin: string,
  unsubscribeUrl: string,
): AnnouncementParts {
  const shown = images.slice(0, ANNOUNCEMENT_LIMIT);
  const remainder = images.length - shown.length;

  const lines = shown.map(
    (image) =>
      `${photoTitle(image.title)} — ${image.author.name}\n${origin}/photo/${image.id}`,
  );

  const items = shown
    .map(
      (image) => `<li style="margin:0 0 18px">
      <a href="${escapeHtml(`${origin}/photo/${image.id}`)}" style="color:#e8eaed;text-decoration:none;font-weight:600">${escapeHtml(photoTitle(image.title))}</a>
      <div style="margin-top:2px;color:#6b7178;font-size:13px">${escapeHtml(image.author.name)}</div>
      <div style="margin-top:4px;color:#a8adb4;font-size:13px;line-height:1.5">${escapeHtml(photoAltText(image))}</div>
    </li>`,
    )
    .join("\n");

  const more =
    remainder > 0 ? `\n\nAnd ${remainder} more, in the gallery.` : "";
  const moreHtml =
    remainder > 0
      ? `<p style="margin:0 0 24px;color:#6b7178;font-size:13px">And ${remainder} more, in the gallery.</p>`
      : "";

  return {
    subject: subjectFor(images),
    text: [
      images.length === 1
        ? "A new photograph is up."
        : `${images.length} new photographs are up.`,
      "",
      lines.join("\n\n"),
      more,
      "",
      `Unsubscribe: ${unsubscribeUrl}`,
    ].join("\n"),
    html: `<p style="margin:0 0 24px;color:#a8adb4;line-height:1.6">
         ${images.length === 1 ? "A new photograph is up." : `${images.length} new photographs are up.`}
       </p>
       <ul style="margin:0 0 24px;padding:0;list-style:none">
${items}
       </ul>
       ${moreHtml}
       <p style="margin:0;color:#6b7178;font-size:13px;line-height:1.6">
         <a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b7178">Stop following</a>
       </p>`,
  };
}
