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
    <a href="${href}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#e8eaed;color:#0b0e12;text-decoration:none;font-weight:600">${label}</a>
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
         ${displayName}, your work is a fit. Welcome.
       </p>
       ${button(url, "Publish your first photograph")}
       <p style="margin:0;color:#6b7178;font-size:13px;line-height:1.6">
         Sign in with this address. Upload the full-size original — the gallery
         handles the rest.
       </p>`,
    ),
  });
}
