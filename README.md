# the beauty of earth.

A full-screen photo gallery, open to a small set of invited photographers.
Next.js App Router, React 19, Tailwind v4. Photographs live in Vercel Blob;
metadata, contributors and view counts in Neon Postgres.

See [docs/CONTRIBUTING-PHOTOS.md](docs/CONTRIBUTING-PHOTOS.md) for how
contributions work and what an operator has to set up.

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
| `SITE_URL` | production | Canonical origin, e.g. `https://beautyofearth.example`. Magic-link emails are built from this and **never** from the request `Host` header. Falls back to `VERCEL_PROJECT_PRODUCTION_URL`, then localhost. |
| `RESEND_API_KEY` | to send email | Without it, sign-in links are printed to the server console instead of emailed. |
| `EMAIL_FROM` | to send email | The verified sender address, e.g. `hello@beautyofearth.example`. |

`vercel env pull .env.local` fetches the first two. Then apply the schema:

```bash
npm run db:migrate
```

The migrations are additive and idempotent — re-running them is a no-op.

## Scripts

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

## Toolchain

Biome 2 replaces ESLint and Prettier and does linting, formatting and
import sorting in one pass. The configuration is deliberately strict:
381 rules across a11y, complexity, correctness, performance, security,
style and suspicious, plus the `next`, `react`, `project` and `types`
domains. `types` enables the rules that need type inference.

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
