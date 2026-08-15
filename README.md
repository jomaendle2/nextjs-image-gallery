# the beauty of earth

A full-screen photo gallery, open to a small set of invited photographers.
Next.js App Router, React 19, Tailwind v4. Photographs live in Vercel Blob;
metadata, contributors and view counts in Neon Postgres.

See [docs/CONTRIBUTING-PHOTOS.md](docs/CONTRIBUTING-PHOTOS.md) for how
contributions work and what an operator has to set up, and
[docs/quality-audit.md](docs/quality-audit.md) for the production-readiness
record — what was found, what was decided, and what is deliberately not done.

## Routes

| Route | What it is |
| --- | --- |
| `/` | The gallery: every published photograph, newest first behind a pinned opener |
| `/photo/<id>` | One photograph, with its own metadata and social card |
| `/photographers` | Everyone contributing, and the way in for anyone who wants to |
| `/by/<slug>` | A photographer's work as a contact sheet |
| `/by/<slug>/slideshow` | The same work in the viewer |
| `/feed.xml` | The whole gallery, as a subscription |
| `/by/<slug>/feed.xml` | One photographer, as a subscription |
| `/contribute` | Sign in, for invited photographers |
| `/contribute/photos` | A contributor's own photographs |
| `/contribute/apply` | The public application form |
| `/contribute/admin` | Owner only; 404 for everyone else |

`sitemap.xml`, `robots.txt` and `manifest.webmanifest` are generated from the
same data rather than written by hand, so a new photographer or photograph
appears in them without anyone remembering to.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment

| Variable | Required | What it is |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon connection string. |
| `BLOB_READ_WRITE_TOKEN` | yes | Vercel Blob store. Set automatically once the store is linked to the project. |
| `SITE_URL` | **production build fails without it** | Canonical origin. Every link the site emails is built from this and **never** from the request `Host` header, so a magic link cannot be pointed at an attacker's domain. Falls back to `VERCEL_PROJECT_PRODUCTION_URL`, then localhost — which is why production refuses to build without it rather than emailing people an unfamiliar domain. |
| `RESEND_API_KEY` | **production build fails without it** | In development a missing key prints messages to the terminal, which is how you read a sign-in link locally. In production it throws. |
| `EMAIL_FROM` | **production build fails without it** | The verified sender, e.g. `contact@thebeautyof.earth`. Required alongside the key: with either missing nothing sends. |
| `CRON_SECRET` | for the weekly reminder | Vercel sends it as `Authorization: Bearer …` to `/api/cron/announce-reminder`. Without it the route refuses to run rather than becoming a public way to ring the owner's inbox. |

`vercel env pull .env.local` fetches the first two. Then apply the schema:

```bash
npm run db:migrate
```

The migrations are additive and idempotent — re-running them is a no-op.

## Scripts

See **[docs/how-it-works.md](docs/how-it-works.md)** for what each service
does, how to sign in as admin, and how to test the membership end to end;
**[docs/launch-checklist.md](docs/launch-checklist.md)** for what must be set
before sharing the site; **[docs/next-version.md](docs/next-version.md)** for
what was deliberately left out and what triggers each; and **[docs/security-architecture.md](docs/security-architecture.md)**
for the invariants `src/lib/security.test.ts` enforces.

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server (Turbopack, the default in Next 16) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Biome: lint + format check + import sorting |
| `npm run lint:fix` | Same, applying every safe fix |
| `npm run format` | Format only |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests |
| `npm run db:migrate` | Apply the additive schema (safe to re-run) |
| `npm run db:import-assets` | One-off import of the original photos (already run) |

Operational scripts, run with `node --env-file=.env.local`:

| Script | What it does |
| --- | --- |
| `scripts/setup-billing-portal.mts` | Creates the Stripe billing portal configuration. Once per Stripe mode. |
| `scripts/smoke-membership.mts` | Webhook forgery, replay, dunning, cancellation. Needs `stripe listen`. |
| `scripts/smoke-portal.mts` | The member's side: real customer, real session, real cookie. |
| `scripts/smoke-email.mts` | Sends one of every email template. Needs the `alias-loader` import. |

## Toolchain

Biome 2 replaces ESLint and Prettier and does linting, formatting and
import sorting in one pass. The configuration is deliberately strict:
395 rules across a11y, complexity, correctness, performance, security,
style and suspicious — every rule the schema offers that is not written for
Vue, Qwik or Solid — plus the `next`, `react`, `project` and `types`
domains. `types` enables the rules that need type inference. Twelve are off,
each for a reason given below.

Rules absent from `biome.json` fall back to the recommended preset rather
than to "on", which is how the six test-hygiene rules — `noFocusedTests`,
`noSkippedTests` and friends — went missing. A stray `.only` could have kept
CI green while running a single test.

TypeScript runs with `strict` plus `noUncheckedIndexedAccess`,
`verbatimModuleSyntax`, `noImplicitOverride` and
`noPropertyAccessFromIndexSignature`.

### Rules that are off, and why

Every exception is deliberate. Do not re-enable one without reading the
reason first.

| Rule | Why |
| --- | --- |
| `noReactSpecificProps` | Written for Solid. It flags `className`, and its autofix rewrites it to `class`, which silently unstyles the entire app. The Qwik/Solid/Vue/Svelte rule families are excluded wholesale for the same reason. |
| `noUnnecessaryConditions` | Narrows `ref.current` to its initializer and never widens it, so every `if (!ref.current) return` guard is reported as dead code. Following it would reintroduce null dereferences. |
| `useLiteralKeys` | Directly contradicts `noPropertyAccessFromIndexSignature`, which requires bracket access for index-signature reads such as `process.env[...]`. The type-level rule wins: it catches typos the style rule cannot. |
| `useImportExtensions` | Wants explicit file extensions. Next resolves `@/*` through the bundler, so extensionless specifiers are correct here. |
| `noDefaultExport` | Next requires default exports for page, layout, route and config modules. |
| `useNamingConvention` | Database columns are `snake_case` and cross into TypeScript unchanged. |
| `noMagicNumbers`, `noJsxLiterals`, `noTernary`, `useExportsLast`, `useComponentExportOnlyModules`, `noProcessEnv` | Style preferences that fight ordinary React and Tailwind code. |

`src/app/globals.css` is excluded from Biome's CSS parser, which does not
yet understand Tailwind v4's `@plugin`, `@custom-variant` and
`@theme inline` at-rules.

## Design: liquid glass

Glass is defined once in `globals.css` as three weights — `glass-thin`,
`glass-regular`, `glass-thick` — each combining a blur, a saturation
boost, a specular inset edge and a drop shadow. The saturation is what
makes a panel pick up the colour of the photo behind it instead of going
grey.

Glass is applied only to chrome that genuinely floats over an image.
`backdrop-filter` makes the compositor snapshot and blur everything
behind an element every frame; on a 90px strip that is nearly free, on a
full-viewport layer it is one of the most expensive things a page can do.

`prefers-reduced-transparency` drops every glass surface to a flat fill.
`prefers-reduced-motion` disables the spinners and the colour transition.

## Known follow-up

`next-plausible` is held at v3. v4 replaces the `domain` prop with a
site-specific script URL (`https://plausible.io/js/pa-XXXXX.js`) that has
to be copied from the Plausible dashboard. Upgrading without it would
silently stop analytics.
