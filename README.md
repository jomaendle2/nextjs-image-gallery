# the beauty of earth

A full-screen photo gallery, open to a small set of invited photographers.
Next.js App Router, React 19, Tailwind v4. Photographs live in Vercel Blob;
metadata, contributors and view counts in Neon Postgres.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Node 22.18 or newer; CI builds on 24.

**[docs/README.md](docs/README.md) is the map** — architecture, operations,
the roadmap, and the archived audits this was built out of. Working on the
code, by hand or with an agent, starts at [AGENTS.md](AGENTS.md).

## Routes

| Route | What it is |
| --- | --- |
| `/` | The gallery: every published photograph, newest first behind a pinned opener |
| `/photo/<id>` | One photograph, with its own metadata and social card |
| `/photographers` | Everyone contributing, and the way in for anyone who wants to |
| `/by/<slug>` | A photographer's work as a contact sheet |
| `/by/<slug>/slideshow` | The same work in the viewer |
| `/globe` | The gallery by place, for photographs whose photographer marked one. A grouped list of links that works with no JavaScript, with a canvas globe over it |
| `/membership` | What €5 a month buys, and the way to buy it |
| `/subscribe`, `/subscribe/confirm`, `/subscribe/unsubscribe` | The mailing list, double opt-in |
| `/feed.xml` | The whole gallery, as a subscription |
| `/by/<slug>/feed.xml` | One photographer, as a subscription |
| `/contribute` | Sign in, for invited photographers |
| `/contribute/photos` | A contributor's own photographs |
| `/contribute/apply` | The public application form |
| `/contribute/invite` | A contributor spending one of their three invitations |
| `/contribute/verify` | Where a sign-in link lands, with the button that spends it |
| `/contribute/admin` | Owner only; 404 for everyone else |
| `/imprint`, `/privacy`, `/terms` | The legal pages, rendered from `src/lib/legal.ts` |

`sitemap.xml`, `robots.txt` and `manifest.webmanifest` are generated from the
same data rather than written by hand, so a new photographer or photograph
appears in them without anyone remembering to.

## Getting started

[docs/operations/setup.md](docs/operations/setup.md) has the environment
variables and the first-run steps;
[docs/operations/scripts.md](docs/operations/scripts.md) is the catalogue of
commands. The three that matter every day:

```bash
npm run typecheck
npm run lint
npm test
```

CI runs all three on every push and pull request. Why they are configured the
way they are is in
[docs/architecture/toolchain.md](docs/architecture/toolchain.md).

## Design

[DESIGN.md](DESIGN.md) is the design system: the two registers (the viewer
and the reading pages), the colour tokens, the shared components to reach for
before writing classes, and the mistakes that have actually been made here.
The mechanical half of it is enforced by `src/lib/design.test.ts` and
`src/app/manifest.test.ts` rather than left as prose.
