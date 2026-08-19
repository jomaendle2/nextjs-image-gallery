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

export function page(body: string): string {
  return `<!doctype html>
<html lang="en"><body style="margin:0;padding:32px;background:#0b0e12;font-family:ui-sans-serif,system-ui,sans-serif;color:#e8eaed">
  <h1 style="margin:0 0 16px;font-size:20px;letter-spacing:-0.03em">the beauty of earth.</h1>
  ${body}
</body></html>`;
}

export function button(href: string, label: string): string {
  return `<p style="margin:0 0 24px">
    <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#e8eaed;color:#0b0e12;text-decoration:none;font-weight:600">${escapeHtml(label)}</a>
  </p>`;
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
