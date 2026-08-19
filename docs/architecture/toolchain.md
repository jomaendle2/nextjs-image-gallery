# The toolchain

What the checks are configured to enforce, and — more usefully — what they
are not, and why. Every exception below is a decision. Do not reverse one
without reading the reason first.

`npm run typecheck`, `npm run lint` and `npm test` are what CI runs on every
push and pull request. `npm run build` is not: Vercel builds every push, so a
broken build has never reached `main` unseen. The gap that leaves is that
`vercel-build` also runs `scripts/preflight.mts` and `scripts/migrate.mts`
before the build, so a regression in either surfaces first on a real deploy.
Both are covered by the typechecker and `schema.test.ts` covers the data they
act on; the drivers themselves are not behaviourally tested.

---

## Biome

Biome 2 replaces ESLint and Prettier and does linting, formatting and import
sorting in one pass. The configuration is deliberately strict: 395 rules
across a11y, complexity, correctness, performance, security, style and
suspicious — every rule the schema offers that is not written for Vue, Qwik
or Solid — plus the `next`, `react`, `project` and `types` domains. `types`
enables the rules that need type inference.

Rules absent from `biome.json` fall back to the recommended preset rather
than to "on", which is how the six test-hygiene rules — `noFocusedTests`,
`noSkippedTests` and friends — went missing. A stray `.only` could have kept
CI green while running a single test.

`src/app/globals.css` is excluded from Biome's CSS parser, which does not yet
understand Tailwind v4's `@plugin`, `@custom-variant` and `@theme inline`
at-rules.

### Rules that are off, and why

| Rule | Why |
| --- | --- |
| `noReactSpecificProps` | Written for Solid. It flags `className`, and its autofix rewrites it to `class`, which silently unstyles the entire app. The Qwik/Solid/Vue/Svelte rule families are excluded wholesale for the same reason. |
| `noUnnecessaryConditions` | Narrows `ref.current` to its initializer and never widens it, so every `if (!ref.current) return` guard is reported as dead code. Following it would reintroduce null dereferences. |
| `useLiteralKeys` | Directly contradicts `noPropertyAccessFromIndexSignature`, which requires bracket access for index-signature reads such as `process.env[...]`. The type-level rule wins: it catches typos the style rule cannot. |
| `useImportExtensions` | Wants explicit file extensions. Next resolves `@/*` through the bundler, so extensionless specifiers are correct here. |
| `noDefaultExport` | Next requires default exports for page, layout, route and config modules. |
| `useNamingConvention` | Database columns are `snake_case` and cross into TypeScript unchanged. |
| `noMagicNumbers`, `noJsxLiterals`, `noTernary`, `useExportsLast`, `useComponentExportOnlyModules`, `noProcessEnv` | Style preferences that fight ordinary React and Tailwind code. |

### The restricted imports

`noRestrictedImports` is where an architectural rule can be stated in the one
tool that reads it while you type. Each entry names the document that
explains it, because a lint error that says only "not allowed" gets
suppressed rather than understood.

| Restricted | Allowed in | Why |
| --- | --- | --- |
| `maplibre-gl` | `src/app/contribute/photos/MapSurface.tsx` | Invariant I14: the map library must never reach a public page. |
| `stripe` | `src/lib/stripe.ts`, the Stripe routes, `scripts/` | ~19 MB, and Next traces imports. `src/lib/members/offer.ts` exists so that asking *whether* payments are configured does not pull the SDK into a footer. |
| `@/lib/database` | the repository modules, `src/lib/auth/`, `src/app/api/` | The SQL client is server-only, and data access goes through a repository so that authorisation lives in the `WHERE` clause. |
| `@/app/**` and `@/components/**`, from `src/lib`, `src/hooks`, `src/data` | nothing | Layering. Those three are underneath the app, not beside it. `@/app/form-state` was the only thing reaching up; it is `@/lib/form-state` now. |

These complement the tests in `src/lib/security-location.test.ts` and
`src/lib/security-membership.test.ts` rather than replacing them: a linter
sees one file at a time and cannot assert that *exactly one* file in the tree
mentions something, or that a mention in a string counts.

## TypeScript

`strict`, plus `noUncheckedIndexedAccess`, `verbatimModuleSyntax`,
`noImplicitOverride`, `noFallthroughCasesInSwitch`,
`noPropertyAccessFromIndexSignature`, `noImplicitReturns`,
`noUncheckedSideEffectImports`, `exactOptionalPropertyTypes`,
`moduleDetection: "force"` and `erasableSyntaxOnly`.

All but one of those went in for nothing — zero errors each, on a codebase
already written that way. `exactOptionalPropertyTypes` cost four, all of one
kind: code setting an optional property to `undefined` to mean "clear it",
where the flag insists that an explicit `undefined` is a value and an absent
key is a different state. Two of the four were real — `setStatus` in
`UploadForm` would have carried a failed upload's message onto the retry that
succeeded, had anything rendered it.

**`erasableSyntaxOnly` is the one worth explaining.** Every script under
`scripts/` runs through node's type *stripping*, not a compiler — see
`scripts/alias-loader.mjs`. Stripping erases annotations and refuses
everything else, so an `enum` or a parameter property in any file those
scripts transitively import is a `SyntaxError` at run time. `vercel-build` is
one of those scripts, so "run time" can mean "on a production deploy". Three
Biome style rules happen to cover most of that surface today; this flag
states the actual constraint in the tool that knows about it.

`typecheck` is two invocations. `tsconfig.json`'s `include` uses `**/*.ts`,
which does not match `.mts` — so `scripts/` was invisible to `tsc` until
`tsconfig.scripts.json` existed, and `toPath` spent a release being called
with one of its three arguments. The second config also carries
`allowImportingTsExtensions`, because a stripped script must name the
extension it imports and a bundled application must not.

### Turned down, deliberately

| Flag | Why not |
| --- | --- |
| `skipLibCheck: false` | Would typecheck every `.d.ts` in `node_modules`. The errors would be in code nobody here can fix, arriving on somebody else's release schedule, turning `npm update` into a blocking event. Every other flag enforces our invariants; this one enforces our dependencies'. |
| `noUnusedLocals`, `noUnusedParameters` | Biome already has `noUnusedVariables`, `noUnusedImports` and `noUnusedFunctionParameters` at error. Duplicating them moves the diagnostic out of the editor's fast pass into `tsc`. |
| `allowUnreachableCode: false`, `allowUnusedLabels: false` | Covered by `noUnreachable` and `noUnusedLabels`, and there is not a label in the tree. |

## What is not checked at all

Nothing detects a symbol that is exported but used only in its own file;
about thirty are. A tool like `knip` would find them, at the cost of a
dependency and a configuration file full of Next's convention-reached entry
points. It is on [the roadmap](../roadmap.md) rather than in the build.
