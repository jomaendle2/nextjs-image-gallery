/**
 * Prints a working sign-in link, without going through the email provider.
 *
 * Break-glass for the owner. If Resend is down, a domain falls out of
 * verification, or `EMAIL_FROM` is wrong, this is how you get back into
 * `/contribute/admin` to fix it — which is precisely when you cannot receive
 * the email that would let you in.
 *
 * Usage:
 *   node --import ./scripts/alias-loader.mjs --env-file=.env.local \
 *     scripts/mint-link.mts you@example.com
 *
 * or `npm run mint-link -- you@example.com`.
 *
 * It calls `mintLoginToken` rather than reimplementing it. The previous
 * version hashed and generated its own secret inline, with a note saying the
 * duplication was necessary because scripts run under plain Node and cannot
 * resolve the `@/` alias the app modules use. That was true until
 * `alias-loader.mjs` existed, and the duplication was the bad kind:
 * security-critical code copied into a tool used only in an emergency. Change
 * `hashSecret` and this would go on minting tokens the application cannot
 * verify, and you would find out while locked out.
 *
 * Using the real function also means the real rules apply — the address must
 * belong to a live contributor *or* a member, exactly as the sign-in form
 * requires, rather than the contributors-only check this used to do.
 */
import process from "node:process";
import { mintLoginToken } from "../src/lib/auth/tokens.ts";
import { siteOrigin } from "../src/lib/site-url.ts";

const [, , emailArg] = process.argv;
if (!emailArg) {
  console.error(
    "Usage: mint-link.mts <email>\n" +
      "Run with --import ./scripts/alias-loader.mjs, or use `npm run mint-link --`.",
  );
  process.exit(1);
}

const secret = await mintLoginToken(emailArg.trim());
if (secret === null) {
  console.error(
    `No live contributor or member with the address ${emailArg.trim()}.`,
  );
  process.exit(1);
}

console.log("Sign-in link (works once, valid 15 minutes):");
console.log(`${siteOrigin()}/contribute/verify?token=${secret}`);
