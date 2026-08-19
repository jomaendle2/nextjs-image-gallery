/**
 * Refuses to build production without the configuration production needs.
 *
 * Run by `vercel-build` before the migration and the build itself. Preview
 * and local builds are untouched — they have sensible fallbacks and nobody
 * is emailed from them.
 *
 * The rule this follows is the one in `docs/architecture/security.md`:
 * configuration that matters fails closed. A build that stops with a
 * sentence telling you which variable to set costs minutes. The alternative
 * is what nearly shipped — `SITE_URL` unset, `siteOrigin()` falling through
 * to whatever Vercel happened to name the project, and every invitation
 * telling a photographer to sign in at a domain they have never heard of.
 * Unsolicited mail offering an account on an unfamiliar domain is a phishing
 * email, whatever its intent, and no runtime check can undo one that has
 * been delivered.
 *
 * Only variables whose absence is silently wrong belong here. Anything that
 * already fails loudly at runtime — `DATABASE_URL`, `STRIPE_SECRET_KEY` —
 * does not need a second guard. Anything genuinely optional, like
 * `STRIPE_MEMBERSHIP_PRICE_ID` while the membership is switched off, must
 * not be here at all: a preflight that blocks a deploy over something
 * deliberately unset teaches people to bypass it.
 */
import process from "node:process";

interface Required {
  name: string;
  why: string;
}

const REQUIRED: Required[] = [
  {
    name: "SITE_URL",
    why: "every link the site emails is built from it; unset, it falls back to Vercel's project URL and invitations point at a domain nobody recognises",
  },
  {
    name: "EMAIL_FROM",
    why: "no message can be sent without a verified sender, and sending fails closed in production",
  },
  {
    name: "RESEND_API_KEY",
    why: "sign-in links, invitations and confirmations all go through it",
  },
];

function main(): void {
  // Preview and development have working fallbacks and mail nobody.
  if (process.env["VERCEL_ENV"] !== "production") {
    console.log("preflight: not a production build, skipping.");
    return;
  }

  const missing = REQUIRED.filter(({ name }) => {
    const value = process.env[name];
    return value === undefined || value.trim() === "";
  });

  if (missing.length === 0) {
    console.log(`preflight: ${REQUIRED.length} production variables present.`);
    return;
  }

  console.error(
    `\nRefusing to build production: ${missing.length} required ` +
      `variable${missing.length === 1 ? " is" : "s are"} not set.\n`,
  );
  for (const { name, why } of missing) {
    console.error(`  ${name}`);
    console.error(`    ${why}`);
    console.error(`    vercel env add ${name} production\n`);
  }
  console.error(
    "See docs/operations/setup.md. This check runs only for production;\n" +
      "preview and local builds are unaffected.\n",
  );
  process.exit(1);
}

main();
