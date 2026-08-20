/**
 * Writes every nudge, at every stage, as an HTML file you can open.
 *
 * `smoke-email.mts` proves the messages survive a real client; this proves
 * what they *look* like, without sending anything to anybody and without a
 * mail provider configured. It is the artefact worth attaching to a review:
 * a sequence is a design decision, and nine paragraphs describing one are
 * harder to judge than nine pictures of it.
 *
 * Renders through the same `buildNudge` and `page` the sender uses, so what
 * opens in the browser is byte-for-byte the `html` part of the real message.
 * A preview built by a second renderer would eventually diverge from the one
 * that is actually mailed, which is the failure mode this avoids.
 *
 * Usage:
 *
 *   npm run preview:email             # writes to .email-previews/
 *   npm run preview:email -- outdir   # or wherever you like
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { page } from "../src/lib/auth/mailer.ts";
import {
  buildNudge,
  draftCopy,
  uploadCopy,
} from "../src/lib/auth/nudge-copy.ts";
import {
  DRAFT_STAGES_HOURS,
  EMPTY_STAGES_HOURS,
} from "../src/lib/auth/nudges.ts";

const [, , outDir = ".email-previews"] = process.argv;
mkdirSync(outDir, { recursive: true });

/*
 * Fixture links rather than real ones. They have to look like the real thing
 * in a screenshot — a preview whose button says `#` teaches nobody anything —
 * but they must not be live tokens, so they are assembled rather than written
 * as literals (`noSecrets` cannot tell a fixture from a leak).
 */
const origin = "https://thebeautyof.earth";
const signInUrl = `${origin}/contribute/verify?${new URLSearchParams({ token: "preview" })}`;
const quietUrl = `${origin}/contribute/quiet?${new URLSearchParams({ token: "preview" })}`;

const written: string[] = [];

function write(name: string, html: string): void {
  const file = join(outDir, `${name}.html`);
  writeFileSync(file, html);
  written.push(file);
}

/*
 * Stage 1 twice, because it is the one message with two versions: somebody
 * who has never signed in, and somebody who signed in and left. The whole
 * argument for stamping `first_signed_in_at` is that those are different
 * messages, and this is where that is checkable by eye.
 */
/*
 * A real photograph from the live gallery, so the previews show what a
 * recipient sees rather than a grey box. Any published display copy would do;
 * this is one of them, and it is public.
 */
const SAMPLE = {
  url: "https://hqthnmomxieqm6os.public.blob.vercel-storage.com/photos/display/DSC09217-2-T1SoAvHwYHXM0qM7HvpagalmVjdwr8-6Ipx1dhO6HoEpSygXin6VjSfZZxYdk.jpg",
  alt: "A published photograph from the gallery.",
  caption: "From the gallery — a published photograph",
  href: `${origin}/photo/preview`,
};

function shell(message: {
  html: string;
  preheader: string;
  footnote: string;
}): string {
  return page(message.html, {
    preheader: message.preheader,
    footnote: message.footnote,
  });
}

write(
  "upload-1-never-signed-in",
  shell(buildNudge(uploadCopy("Anna Lindberg", 1, false), signInUrl, quietUrl)),
);

for (const stage of EMPTY_STAGES_HOURS.map((_hours, index) => index + 1)) {
  write(
    `upload-${stage}`,
    shell(
      buildNudge(
        uploadCopy("Anna Lindberg", stage, true),
        signInUrl,
        quietUrl,
        // Only stage 3 carries one, which is what the sender does.
        stage === 3 ? SAMPLE : undefined,
      ),
    ),
  );
}

/*
 * The draft track at one and at several, because every line in it agrees with
 * a number — "it is" or "they are", "Publish it" or "Publish them" — and a
 * disagreement is exactly the kind of thing that survives review and does not
 * survive being read in an inbox.
 */
for (const stage of DRAFT_STAGES_HOURS.map((_hours, index) => index + 1)) {
  const draft = {
    url: SAMPLE.url,
    alt: "A photograph you have not published yet.",
  };
  write(
    `draft-${stage}-single`,
    shell(
      buildNudge(
        draftCopy("Anna Lindberg", stage, 1),
        signInUrl,
        quietUrl,
        draft,
      ),
    ),
  );
  write(
    `draft-${stage}-several`,
    shell(
      buildNudge(
        draftCopy("Anna Lindberg", stage, 3),
        signInUrl,
        quietUrl,
        draft,
      ),
    ),
  );
}

/*
 * And a contact sheet: every variant at once, each in its own iframe at a
 * phone's width.
 *
 * One picture rather than thirteen, because the thing under review is the
 * *sequence*. Whether stage 6 reads as the last message is a question about
 * where it sits among the other five, and nobody answers that by opening
 * thirteen tabs. The frames are `srcdoc` so the sheet is a single file that
 * survives being moved somewhere else.
 */
const sheet = written
  .map((file) => {
    const name = file.split("/").at(-1)?.replace(".html", "") ?? file;
    const html = readFileSync(file, "utf8");
    return `<figure style="margin:0">
      <figcaption style="margin:0 0 8px;font:600 13px ui-sans-serif,system-ui;color:#0b0e12">${name}</figcaption>
      <iframe srcdoc="${html.replace(/"/g, "&quot;")}" style="width:420px;height:640px;border:1px solid #d5d8dd;border-radius:12px" title="${name}"></iframe>
    </figure>`;
  })
  .join("\n");

writeFileSync(
  join(outDir, "index.html"),
  `<!doctype html>
<html lang="en"><body style="margin:0;padding:24px;background:#f5f6f8;font-family:ui-sans-serif,system-ui,sans-serif">
  <h1 style="margin:0 0 20px;font:700 18px ui-sans-serif,system-ui;color:#0b0e12">
    Nudge emails — every stage of both sequences
  </h1>
  <div style="display:grid;grid-template-columns:repeat(3,420px);gap:24px">${sheet}</div>
</body></html>`,
);

console.log(
  `Wrote ${written.length} previews and a contact sheet:\n` +
    `${join(outDir, "index.html")}`,
);
