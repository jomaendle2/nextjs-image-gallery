<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# the beauty of earth

A full-screen photo gallery open to a small set of invited photographers.
Next.js 16 App Router, React 19, Tailwind v4, TypeScript, Biome, Vitest.
Photographs in Vercel Blob; everything else in Neon Postgres. Payments by
Stripe, mail by Resend.

This file is a table of contents, not the documentation. Follow the pointers.

## Commands

```bash
npm run dev         # Turbopack
npm run typecheck   # the app, then scripts/ — two invocations, both required
npm run lint        # Biome: lint, format, import order. --write to fix
npm test            # Vitest
```

CI runs the last three on every push and pull request. Run them before you
say you are done. Node 24 or newer, or every `.mts` script dies on a type
annotation.

## Rules that are not negotiable

Each is enforced somewhere. The enforcement is named so you can read why.

- **State changes on POST, never GET.** A link that acts is a link a mail
  scanner spends. `src/lib/security.test.ts` (I1).
- **Authorization lives in the `WHERE` clause**, not in a check before the
  query. Data access goes through `src/lib/*/repository.ts` (I2).
- **A public payload carries only the coarse point.** Never `precise_*`,
  never a members-only column (I6, I15).
- **Links are built from `SITE_URL`**, never from the request `Host` header.
- **Missing security-relevant configuration fails closed** (I9).
- **Colour comes from tokens in `src/app/globals.css`.** No hex in a
  component, no Tailwind palette utility. `src/lib/design.test.ts`.
- **Type comes from `src/components/ui/field.ts`.** Do not hand-set a heading.
- **Every interactive control clears 44px** in both directions.
- **`process.env["X"]`, in brackets** — `noPropertyAccessFromIndexSignature`.
  And every indexed read is `| undefined`; `noUncheckedIndexedAccess` is on.
- **Row types are `snake_case`** where they cross from SQL unchanged.
- **Destructive scripts refuse without `--apply`** and print the host first.
  `.env.local` points at production.
- **The twelve disabled Biome rules are deliberate.** Read
  [docs/architecture/toolchain.md](docs/architecture/toolchain.md) before
  re-enabling one; two of them have autofixes that break the app.
- **Prose is checked.** A path, an `npm run` name or a `docs/…` link that
  does not resolve fails `npm test`. That applies to comments in code too.

## Where things are

| Need | Go to |
| --- | --- |
| The whole map of the docs | [docs/README.md](docs/README.md) |
| What each part owns, and the traps | [docs/architecture/overview.md](docs/architecture/overview.md) |
| Auth, payments, location, anything a stranger reaches | [docs/architecture/security.md](docs/architecture/security.md) |
| The schema, and what each column is for | [docs/architecture/data-model.md](docs/architecture/data-model.md) |
| A lint rule in your way | [docs/architecture/toolchain.md](docs/architecture/toolchain.md) |
| Components, colour, motion | [DESIGN.md](DESIGN.md) |
| Environment variables, first run | [docs/operations/setup.md](docs/operations/setup.md) |
| Publishing, announcing, erasing, backups | [docs/operations/runbook.md](docs/operations/runbook.md) |
| The command that does the thing | [docs/operations/scripts.md](docs/operations/scripts.md) |
| What is deliberately not built, and what would change that | [docs/roadmap.md](docs/roadmap.md) |
| Why something is the way it is | [docs/archive/README.md](docs/archive/README.md) |

## How this codebase is written

Read a neighbouring file before writing a new one. Two habits are load-bearing
and easy to miss:

**Comments carry the reason, not the mechanics.** Nearly every non-obvious
line here has a paragraph above it saying which bug produced it. Match that.
A comment that restates the code is noise; one that says "this was got wrong
twice, here is how" is the most valuable thing in the file.

**Invariants are tests, not intentions.** When you find yourself writing "we
must always…", write the test instead. `src/lib/source-text.ts` exists so
that a test can assert on the *shape* of the code — that exactly one file
imports something, that no page hand-rolls a class run — and eight such files
already do.
