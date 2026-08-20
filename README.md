```
                       .
            .· · ·  ·  ·  ·  · · ·.
        . · ·  ·   ·   ·   ·   ·  · · .
     .··  ·   ·   ·    ·    ·   ·   ·  ··.
   .· ·  ·   ·    ·    ·    ·    ·   ·  · ·.
  .· ·  ·   ·     ·    ·    ·     ·   ·  · ·.
 .· ·   ·   ·    ·     ·     ·    ·   ·   · ·.
 .· ·  ·    ·    ·     ·     ·    ·    ·  · ·.
 .· ·   ·   ·    ·     ·     ·    ·   ·   · ·.
  .· ·  ·   ·     ·    ·    ·     ·   ·  · ·.
   .· ·  ·   ·    ·    ·    ·    ·   ·  · ·.
     .··  ·   ·   ·    ·    ·   ·   ·  ··.
        . · ·  ·   ·   ·   ·   ·  · · .
            .· · ·  ·  ·  ·  · · ·.
                       .

                the beauty of earth.
```

<div align="center">

[![CI](https://github.com/jomaendle2/nextjs-image-gallery/actions/workflows/ci.yml/badge.svg)](https://github.com/jomaendle2/nextjs-image-gallery/actions/workflows/ci.yml)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-000?logo=nextdotjs&logoColor=fff)](https://nextjs.org)
[![React 19](https://img.shields.io/badge/React-19-087ea4?logo=react&logoColor=fff)](https://react.dev)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000?logo=vercel&logoColor=fff)](https://vercel.com)

</div>

A full-screen photo gallery, open to a small set of invited photographers.
There is no sign-up: somebody already here spends one of their invitations, or
an application is accepted. What that buys is the whole product — publish
directly, with no approval queue, and unpublish just as fast.

**[docs/README.md](docs/README.md) is the map** — architecture, operations and
the roadmap. Working on the code, by hand or with an agent, starts at
[AGENTS.md](AGENTS.md).

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Node 22.18 or newer, because every `.mts` script
in `scripts/` dies on a type annotation below it; CI and Vercel build on 24.

The app needs a database and a blob store before most of it does anything.
[docs/operations/setup.md](docs/operations/setup.md) has the environment
variables and the first-run order, including which ones fail closed rather
than degrading — a missing security-relevant value stops the process instead
of quietly disabling a check.

## The stack

Every hosted piece is something Vercel either runs or provisions, so there is
one dashboard and one set of environment variables rather than five.

| Concern | What runs it | Where it is wired up |
| --- | --- | --- |
| App | Next.js 16 App Router, React 19, TypeScript | `src/app/` |
| Styling | Tailwind v4, tokens only | `src/app/globals.css` |
| Photographs | Vercel Blob | `src/lib/blob-host.ts` |
| Everything else | Neon Postgres, over the serverless driver | `src/lib/database.ts` |
| Schema | One idempotent statement list, applied on deploy | `src/lib/schema.ts` |
| Payments | Stripe, for the €5 membership | `src/lib/stripe.ts` |
| Mail | Resend | `src/lib/auth/mailer.ts` |
| Maps | MapLibre and MapTiler | `src/lib/maptiler.ts` |
| Captions | The AI SDK, as an offer rather than a step | `src/lib/ai/suggest.ts` |

Photographs are the exception to "everything else in Postgres", and the split
is deliberate: the original a photographer uploads is kept byte-for-byte,
never re-encoded and never linked from the site.

## Layout

```
src/app/          Routes. Colocated `actions.ts` and components per route.
src/components/   gallery/ the viewer · geo/ the globe · ui/ shared primitives
src/lib/          The domain. Data access is `*/repository.ts`, and only there.
scripts/          Operational `.mts` commands; destructive ones need --apply.
docs/             architecture/ · operations/ · roadmap.md
```

Two conventions carry more weight than the folder names, and both are enforced
rather than trusted:

**Authorization lives in the `WHERE` clause**, not in a check before the
query, so a query that forgets it returns nothing rather than everything. The
tests that hold that line read the source of `src/lib/photos/repository.ts`
directly.

**A public payload carries only the coarse point.** Precise coordinates and
members-only columns exist, and the tests in `src/lib/security-location.test.ts`
assert on which queries are allowed to name them.

## Routes

<details>
<summary>The full table</summary>

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
| `/contribute/quiet` | Where the opt-out link in a reminder lands, with the button that spends it |
| `/contribute/admin` | Owner only; 404 for everyone else |
| `/imprint`, `/privacy`, `/terms` | The legal pages, rendered from `src/lib/legal.ts` |

</details>

`sitemap.xml`, `robots.txt` and `manifest.webmanifest` are generated from the
same data rather than written by hand, so a new photographer or photograph
appears in them without anyone remembering to.

Anything that changes state is a `POST`. A link that acts is a link a mail
scanner spends, which is why `/contribute/verify` and `/contribute/quiet` are
pages with a button rather than the URL doing the work.

## The three gates

```bash
npm run typecheck   # the app, then scripts/ — two invocations, both required
npm run lint        # Biome: lint, format and import order. --write to fix
npm test            # Vitest
```

CI runs all three on every push and pull request, and `main` requires them to
pass before a merge. Why they are configured the way they are — including the
disabled Biome rules, two of which have autofixes that break the app — is in
[docs/architecture/toolchain.md](docs/architecture/toolchain.md).

The test suite is not only about behaviour. A number of files assert on the
*shape* of the code: that exactly one module imports something, that no page
hand-rolls a class run, that no component contains a hex colour. Prose is
checked too — a path, an `npm run` name or a `docs/` link that does not
resolve fails `npm test`, including in comments. When something here reads
"we must always", there is usually a test rather than a sentence.

## Deployment

Vercel builds every push, and the build is the migration:
`npm run vercel-build` runs a preflight, applies the schema, then builds.
Applying it on deploy rather than by hand is what makes the statement list in
`src/lib/schema.ts` idempotent by requirement instead of by intention.

One Neon database is shared by production, preview and development, and
`scripts/migrate.mts` refuses to migrate outside production. A branch that
adds a column therefore runs against a database without it for as long as the
branch is open — read the column defensively, or the preview build fails
outright. [docs/operations/runbook.md](docs/operations/runbook.md) covers
that and the rest of publishing, announcing, erasing and backups;
[docs/operations/scripts.md](docs/operations/scripts.md) is the catalogue of
commands.

## Design

[DESIGN.md](DESIGN.md) is the design system: the two registers — the viewer,
where the only colour comes from the photograph, and the reading pages — the
colour tokens, the shared components to reach for before writing classes, and
the mistakes that have actually been made here. The mechanical half of it is
enforced by `src/lib/design.test.ts` and `src/app/manifest.test.ts` rather
than left as prose.
