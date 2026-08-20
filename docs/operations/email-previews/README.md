# Previews

Pictures of things that are hard to review as prose: a mail sequence, a screen
that appears once, a share card rendered by somebody else's server. They were
attached to the pull requests that introduced them, and they live here so the
next person changing the copy can see what they are changing it *from*.

The name says "email" because that is what the folder started as. The links to
these files are in merged pull-request descriptions, so it keeps the name.

| File | What it shows |
| --- | --- |
| `nudge-emails.png` | Every stage of both sequences: six for an empty page (including the two versions of stage 1), three for a stalled draft at one photograph and at several. The ones carrying a photograph are the ones arguing for something |
| `quiet-page-ask.png` | `/contribute/quiet` — the opt-out, which is a button rather than a page load |
| `quiet-page-done.png` | The same page afterwards — the accent tick that says the thing happened |
| `quiet-page-nothing.png` | And the other ending: a link that matched nobody, marked as neither an error nor an achievement |
| `workspace-firstrun.png` | The workspace before anything is published, including the line naming whoever invited you |
| `workspace-justlive.png` | The workspace at exactly one published photograph — the first-publish card, which appears once and leaves |
| `og-globe.png` | The share card `/globe` now builds for itself, rendered by `/api/og` |

Regenerate with:

```bash
npm run preview:email
```

That writes one HTML file per variant plus a contact sheet into
`.email-previews/` (gitignored), rendered through the same `buildNudge` and
`page` the sender uses — so what you open is the `html` part of the real
message rather than a second renderer's idea of it. Open
`.email-previews/index.html` and screenshot it to replace `nudge-emails.png`.

`scripts/preview-email.mts` sends nothing and needs no mail provider. To
actually send, `npm run smoke:email -- you@example.com` walks every template
in the site, nudges included.

The two workspace screenshots and the share card are taken by hand against a
dev server: the workspace ones need a session, and the card is whatever
`/api/og` draws for the parameters `src/lib/metadata.ts` builds.
