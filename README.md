# the beauty of earth.

A full-screen photo gallery. Next.js App Router, React 19, Tailwind v4,
view counts in Neon Postgres.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`DATABASE_URL` (a Neon connection string) is required. The view-count API
creates its table on first call.

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
