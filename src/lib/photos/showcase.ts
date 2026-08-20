import { sql } from "@/lib/database";
import { siteOrigin } from "@/lib/site-url";

/**
 * The photograph an email shows when it has to argue for the gallery.
 *
 * Its own file rather than a line in `repository.ts`, for two reasons that
 * happen to agree. That file is at this project's ceiling on length; and
 * three invariants slice it on `export async function` boundaries to prove
 * what the feed and the globe may select, so every export added to it is one
 * more boundary those slices have to be reasoned about around. This query is
 * read by the mail templates and by nothing else.
 */

/** One published photograph, as an email is allowed to show it. */
export interface ShowcasePhoto {
  id: string;
  display_url: string;
  title: string;
  description: string;
  author_name: string;
  author_slug: string;
}

/**
 * The photograph an email shows when it needs to argue for the gallery.
 *
 * Invitations went out with no photograph in them at all — an unsolicited
 * message telling a stranger they had been chosen, by a gallery whose work
 * they could not see without following a link they had no reason to trust
 * yet. One picture is the whole argument, and it is the argument this
 * software exists to make.
 *
 * The opener first, then the newest: the same order the feed uses, so the
 * mail shows what the front page shows rather than a second opinion about
 * what is good. `display_url` and never `blob_url` — the original is the one
 * file here that still carries whatever GPS the camera wrote, and a mail
 * client fetches whatever it is given.
 *
 * Null when nothing is published, which is a real state early on. The caller
 * sends the same message without a photograph rather than a broken one.
 */
export async function latestShowcasePhoto(): Promise<ShowcasePhoto | null> {
  const rows = await sql`
    SELECT p.id, p.display_url, p.title, p.description,
           c.display_name AS author_name, c.slug AS author_slug
    FROM photos p JOIN contributors c ON c.id = p.author_id
    WHERE p.published_at IS NOT NULL AND c.revoked_at IS NULL
    ORDER BY p.is_opener DESC, p.published_at DESC
    LIMIT 1;
  `;
  const [row] = rows;
  return row === undefined ? null : (row as unknown as ShowcasePhoto);
}

/**
 * The same photograph, shaped for a template.
 *
 * Here rather than in each caller because there are three of them — the
 * owner's invitation, a photographer's invitation, and the nudge cron — and
 * the interesting decisions are identical every time: the display copy and
 * never the original, a caption that credits the photographer, and a link to
 * the photograph rather than to the front page.
 *
 * Undefined rather than null, because that is what an optional template
 * argument wants — and the whole point is that a message with no photograph
 * is still a message.
 */
export async function showcaseForMail(): Promise<
  { url: string; alt: string; caption: string; href: string } | undefined
> {
  const newest = await latestShowcasePhoto();
  if (newest === null) {
    return undefined;
  }
  return {
    url: newest.display_url,
    alt: newest.description,
    caption: `${newest.title === "" ? "Untitled" : newest.title} — ${newest.author_name}`,
    href: `${siteOrigin()}/photo/${newest.id}`,
  };
}
