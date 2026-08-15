import process from "node:process";

const TRAILING_SLASHES = /\/+$/;

/**
 * The canonical origin, taken from configuration and never from the request.
 *
 * Magic-link emails carry a login token in the URL, so building that URL from
 * the `Host` header would let anyone who can reach the sign-in form choose
 * where an invited contributor's token gets sent: request a link with
 * `Host: attacker.example`, and the real contributor receives a genuine email
 * pointing at the attacker's domain. The origin therefore has to come from
 * somewhere the client cannot influence.
 *
 * Precedence:
 *   1. `SITE_URL`, if you have set it — the production domain.
 *   2. `VERCEL_PROJECT_PRODUCTION_URL`, which Vercel sets for the project.
 *   3. localhost, for development.
 */
export function siteOrigin(): string {
  const configured = process.env["SITE_URL"];
  if (configured !== undefined && configured !== "") {
    return configured.replace(TRAILING_SLASHES, "");
  }

  const vercelHost = process.env["VERCEL_PROJECT_PRODUCTION_URL"];
  if (vercelHost !== undefined && vercelHost !== "") {
    return `https://${vercelHost}`;
  }

  return "http://localhost:3000";
}
