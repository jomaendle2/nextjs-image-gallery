import process from "node:process";

/**
 * One seam for outbound mail.
 *
 * Provider is Resend, provisioned through the Vercel Marketplace, which
 * supplies `RESEND_API_KEY`. Its REST API is two fields and a POST, so there
 * is no SDK dependency to carry.
 *
 * Without a key — local development, or before the Marketplace terms have
 * been accepted — the link is printed to the server console instead. The
 * whole sign-in flow is therefore testable with nothing provisioned, and the
 * fallback is loud rather than silent.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function plainText(url: string): string {
  return [
    "Sign in to the beauty of earth.",
    "",
    url,
    "",
    "This link works once and expires in 15 minutes.",
    "If you did not ask for it, you can ignore this email.",
  ].join("\n");
}

function html(url: string): string {
  return `<!doctype html>
<html lang="en"><body style="margin:0;padding:32px;background:#12161a;font-family:ui-sans-serif,system-ui,sans-serif;color:#e8eaed">
  <h1 style="margin:0 0 16px;font-size:20px;letter-spacing:-0.03em">the beauty of earth.</h1>
  <p style="margin:0 0 24px;color:#a8adb4;line-height:1.6">
    Here is your sign-in link. It works once and expires in 15 minutes.
  </p>
  <p style="margin:0 0 24px">
    <a href="${url}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#e8eaed;color:#12161a;text-decoration:none;font-weight:600">
      Sign in
    </a>
  </p>
  <p style="margin:0;color:#6b7178;font-size:13px;line-height:1.6">
    If you did not ask for this, you can ignore it.
  </p>
</body></html>`;
}

export async function sendLoginEmail(to: string, url: string): Promise<void> {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["EMAIL_FROM"];

  if (apiKey === undefined || from === undefined) {
    console.warn(
      `\n  [no email provider configured] magic link for ${to}:\n  ${url}\n`,
    );
    return;
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: "Your sign-in link",
      text: plainText(url),
      html: html(url),
    }),
  });

  if (!response.ok) {
    // Surfaced to the caller, which still shows the same neutral message to
    // the visitor — a delivery failure must not reveal whether the address
    // was on the invite list.
    throw new Error(
      `Email provider rejected the request: ${response.status} ${await response.text()}`,
    );
  }
}
