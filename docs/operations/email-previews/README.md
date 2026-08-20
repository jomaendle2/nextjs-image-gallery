# Email previews

Pictures of messages, kept because a sequence is a design decision and prose
describing one is harder to judge than a picture of it. These were attached to
the pull request that introduced the reminders; they live here so the next
person changing the copy can see what they are changing it *from*.

| File | What it shows |
| --- | --- |
| `nudge-emails.png` | Every stage of both sequences: six for an empty page (including the two versions of stage 1), three for a stalled draft at one photograph and at several. The ones carrying a photograph are the ones arguing for something |
| `quiet-page-ask.png` | `/contribute/quiet` — the opt-out, which is a button rather than a page load |
| `quiet-page-done.png` | The same page afterwards — the accent tick that says the thing happened |
| `quiet-page-nothing.png` | And the other ending: a link that matched nobody, marked as neither an error nor an achievement |

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
