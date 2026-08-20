import process from "node:process";

/**
 * The transport, and the helpers every template renders through.
 *
 * Split out of `email.ts` when that file reached this project's own ceiling
 * on file length. The templates are the half that keeps growing, and keeping
 * them in the same file as the one function that talks to the provider meant
 * every new message enlarged the file that owns the security-relevant
 * behaviour — including the fallback that must never quietly print a
 * credential in production.
 *
 * What lives here is what is the same for every message: the provider call,
 * the escaping, and the shell an HTML body is wrapped in. What lives in
 * `email.ts` is what each message *says*.
 *
 * Provider is Resend, which supplies `RESEND_API_KEY`. Its REST API is a POST
 * with a handful of fields, so there is no SDK dependency to carry.
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

export interface Message {
  to: string;
  subject: string;
  text: string;
  html: string;
  /**
   * Extra SMTP headers, passed straight through to the provider.
   *
   * Added for `List-Unsubscribe`, which this site sets on nothing and which
   * the nudges have to carry: a message that asks somebody to do something
   * they did not sign up for needs a machine-readable way out, and the
   * one-click pair (RFC 8058) is what turns a Gmail "unsubscribe" button
   * into an unsubscribe rather than a spam report. A spam report costs the
   * whole domain; an unsubscribe costs one address.
   */
  headers?: Record<string, string>;
}

/**
 * The palette, in sRGB, because email cannot have the stylesheet.
 *
 * Every value is one of `globals.css`'s tokens converted out of OKLCH — the
 * conversion is written beside each so the derivation is checkable rather
 * than remembered. `design.test.ts` bans colour literals everywhere else and
 * exempts this register; the exemption is narrow on purpose, and the way it
 * stays narrow is that these are the only ones. No template writes its own.
 *
 * DESIGN.md's rule survives the crossing intact: **colour that does not mean
 * anything is noise.** So the accent appears on exactly one thing in any
 * message — the action — and everything else is the greyscale the reading
 * pages already use. The colour in these emails is meant to come from the
 * photographs, which is the same arrangement the viewer has.
 */
export const MAIL = {
  /** `--ground`. The same near-black the site and its PWA chrome use. */
  ground: "#0b0e12",
  /** `--color-surface`. One step up, for a block that has to separate. */
  surface: "#12161a",
  /** `--color-accent`, oklch(0.82 0.093 210). The one action. */
  accent: "#76d5e5",
  /** `--color-accent-ink`, oklch(0.24 0.035 210). Text on that fill. */
  accentInk: "#072428",
  /** The three rungs of type, matching the reading pages. */
  text: "#e8eaed",
  muted: "#a8adb4",
  faint: "#6b7178",
  /** A hairline at 8%, which is what `border-white/[0.08]` resolves to. */
  hairline: "#1d2126",
} as const;

const FONT =
  "ui-sans-serif,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

/** What the inbox list shows after the subject, and what it must not show. */
function preheaderBlock(preheader: string): string {
  /*
   * Without this the preview line is whatever the body starts with, which
   * for every message on this site was the same wordmark — eleven messages
   * that read "the beauty of earth. the beauty of earth." in a list.
   *
   * The trailing entities are the standard padding: they stop the client
   * pulling the *next* line of real copy in after a short preheader, without
   * being visible to anybody.
   */
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${escapeHtml(
    preheader,
  )}${"&#847;&zwnj;&nbsp;".repeat(60)}</div>`;
}

/**
 * The document every message is delivered inside.
 *
 * Tables rather than divs for the frame, because Outlook renders through
 * Word and has no flex, no grid, and no reliable `max-width` on a block. The
 * body of a message may still be ordinary paragraphs — those are safe —
 * but the column that centres them cannot be.
 *
 * `color-scheme`/`supported-color-schemes` are the pair that tells a client
 * this design is already dark. Without them Apple Mail inverts an explicitly
 * dark email into a light one, which turns near-black text on near-black
 * into an unreadable message that renders perfectly in every client we would
 * have tested it in.
 */
export function page(
  body: string,
  options: { preheader?: string; footnote?: string } = {},
): string {
  const footnote =
    options.footnote === undefined
      ? ""
      : `<tr><td style="padding:0 28px 28px">
           <div style="height:1px;background:${MAIL.hairline};margin:0 0 20px"></div>
           <div style="color:${MAIL.faint};font-size:12px;line-height:1.6">${options.footnote}</div>
         </td></tr>`;

  return `<!doctype html>
<html lang="en" style="color-scheme:dark;supported-color-schemes:dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
</head>
<body style="margin:0;padding:0;background:${MAIL.ground};font-family:${FONT};color:${MAIL.text};-webkit-font-smoothing:antialiased">
  ${options.preheader === undefined ? "" : preheaderBlock(options.preheader)}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${MAIL.ground}">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:100%;max-width:560px;background:${MAIL.surface};border-radius:20px;overflow:hidden">
        <tr><td style="padding:26px 28px 0">
          <div style="font-size:15px;font-weight:600;letter-spacing:-0.03em;color:${MAIL.text}">the beauty of earth.</div>
          <div style="height:1px;background:${MAIL.hairline};margin:18px 0 0"></div>
        </td></tr>
        ${body}
        ${footnote}
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/**
 * A row of the message's body, so a template never writes a `<td>`.
 *
 * The horizontal padding is the shell's and belongs to it: a template that
 * set its own would be one edit away from a message whose text does not line
 * up with the wordmark above it.
 */
export function block(content: string, padding = "24px 28px 0"): string {
  return `<tr><td style="padding:${padding}">${content}</td></tr>`;
}

/**
 * The small label above the lead, naming what this message is.
 *
 * The thing that was missing rather than the thing that was wrong: eleven
 * messages arrived looking identical, so a photographer could not tell an
 * invitation from a reminder from a sign-in link without reading a paragraph
 * of each. A label is structure encoding something true — which of the
 * gallery's few kinds of message this is — rather than decoration.
 *
 * Deliberately not accented. The accent means "this is the action"; a second
 * accented thing at the top of the message would compete with the button for
 * the one job the reader has.
 */
export function eyebrow(label: string): string {
  return `<div style="font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:${MAIL.faint};margin:0 0 10px">${escapeHtml(
    label,
  )}</div>`;
}

/** The one sentence the message is about, set larger than everything else. */
export function lead(text: string): string {
  return `<div style="font-size:21px;line-height:1.4;letter-spacing:-0.02em;color:${MAIL.text};margin:0 0 14px">${escapeHtml(
    text,
  )}</div>`;
}

/** Supporting prose. Escaped, so a template cannot forget. */
export function paragraph(text: string): string {
  return `<p style="margin:0 0 14px;color:${MAIL.muted};font-size:15px;line-height:1.65">${escapeHtml(
    text,
  )}</p>`;
}

/**
 * The action, as a table rather than a padded anchor.
 *
 * Outlook applies neither padding nor border-radius to an inline anchor, so
 * the old pill arrived there as bare underlined text — the one control in the
 * message, rendered as if it were not one. A single-cell table is the shape
 * that survives, and the `mso` conditional would only be needed for a border
 * radius Outlook cannot draw anyway.
 *
 * Accent fill with `--color-accent-ink` on it: DESIGN.md keeps that pair for
 * "dark text on a solid accent fill. Rare." One primary action in a message
 * nobody asked to receive is exactly the rare case, and it is the only place
 * colour appears in the frame.
 */
export function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 4px">
    <tr><td style="border-radius:999px;background:${MAIL.accent}">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 22px;font-size:15px;font-weight:600;color:${MAIL.accentInk};text-decoration:none;border-radius:999px">${escapeHtml(
        label,
      )}</a>
    </td></tr>
  </table>`;
}

/** One photograph in a message, with its own line of credit under it. */
export interface MailPhoto {
  /** The display copy's URL. Never the original — that one still has EXIF. */
  url: string;
  /** What a screen reader says in place of it. */
  alt: string;
  /** "Low tide — Anna Lindberg", or just a title. */
  caption?: string;
  /** Where it goes when tapped. */
  href?: string;
}

/**
 * A photograph, full width, above the words.
 *
 * The gap this closes is the largest one in the whole register: a gallery
 * that mails people about photographs was sending eleven messages with no
 * photograph in any of them. Everything the site is for was represented by a
 * paragraph of grey text.
 *
 * One, full width, rather than a strip of three. Email has no `object-fit`,
 * so three across means three images squashed to a shared height and each
 * one cropped by nothing — the mix of portrait and landscape here reads
 * badly at 180px. One photograph at its own aspect ratio is also the version
 * that survives a phone, and it is what the thing is *for*.
 *
 * It is not on every message and must not be. A sign-in link is a credential
 * and should arrive in the two seconds it takes to render text; a photograph
 * there is decoration on a door key. These appear where they argue for
 * something: what a photographer would be joining, and what is sitting in
 * their own drafts.
 */
export function photo(image: MailPhoto): string {
  const img = `<img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt)}" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;background:${MAIL.ground}">`;

  return `<tr><td style="padding:20px 0 0">
    ${image.href === undefined ? img : `<a href="${escapeHtml(image.href)}" style="display:block">${img}</a>`}
    ${
      image.caption === undefined
        ? ""
        : `<div style="padding:10px 28px 0;color:${MAIL.faint};font-size:12px;line-height:1.5">${escapeHtml(image.caption)}</div>`
    }
  </td></tr>`;
}

export async function send(message: Message): Promise<void> {
  const { to, subject, text, html, headers } = message;
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["EMAIL_FROM"];

  if (apiKey === undefined || from === undefined) {
    /*
     * Printing the message is a development convenience and a production
     * incident. The body of a sign-in email *is* a valid credential for the
     * life of the link, so writing it to a platform log hands anybody
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
    // `headers` is dropped by JSON.stringify when undefined, so every
    // message that does not set one sends exactly the payload it used to.
    body: JSON.stringify({ from, to, subject, text, html, headers }),
  });

  if (!response.ok) {
    throw new Error(
      `Email provider rejected the request: ${response.status} ${await response.text()}`,
    );
  }
}
