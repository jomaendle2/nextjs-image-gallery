# Commands

Every npm script, and what it is for. The operational ones all carry the
loader flags they need, so there is nothing to remember at the command line —
and `docs.test.ts` fails if a name written here is not in `package.json`.

## Everyday

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server (Turbopack, the default in Next 16) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Biome: lint + format check + import sorting |
| `npm run lint:fix` | Same, applying every safe fix |
| `npm run format` | Format only |
| `npm run typecheck` | `tsc --noEmit` for the app, then again for `scripts/` |
| `npm test` | Vitest |
| `npm run test:watch` | Vitest, watching |

## The database

| Command | What it does |
| --- | --- |
| `npm run db:migrate` | Apply the additive schema. Safe to re-run; runs on every deploy. |
| `npm run db:backfill-pins` | Re-derive an exact point for rows that predate the picker. |
| `npm run db:recoarsen` | Rewrite the public dots after `CELL_KM` changes. See [the runbook](runbook.md). |
| `npm run db:import-assets` | One-off import of the original photographs (already run). |
| `npm run db:erase-contributor -- someone@example.com` | Everything belonging to one person, listed then deleted. |
| `npm run recaption` | Re-run the caption model over published work, snapshotting first. |

Every one of these loads `.env.local`, which points at production, and every
one refuses without `--apply`. Point it at a Neon branch first.

## Smoke suites

Real requests against a running dev server. Nothing left behind.

| Command | Checks | What it covers |
| --- | --- | --- |
| `npm run smoke` | — | Every suite below that needs no arguments. |
| `npm run smoke:pages` | 3 | Each page renders, signed in and out. Catches a server component that throws. |
| `npm run smoke:invite` | 16 | The invite quota, including two concurrent claims racing for one invitation. |
| `npm run smoke:upload` | 13 | The ingest path. Mints its own session; nothing to paste. |
| `npm run smoke:membership` | 23 | Webhook forgery, replay, dunning, ordering, takeover. Signs its own events, so no tunnel needed. |
| `npm run smoke:portal` | 7 | The member's side: real customer, real session, real cookie. |
| `npm run smoke:email -- you@example.com` | — | Sends one of every email template. The address is required, because this one really sends. |

## Break glass and one-offs

| Command | What it does |
| --- | --- |
| `npm run mint-link -- you@example.com` | A sign-in link when mail is down. |
| `npm run stripe:portal-setup` | Creates the Stripe billing portal configuration. Once per Stripe mode. |
| `npm run probe:scale` | Measures the authoring page at 50–600 photographs. Inserts drafts, reads the page, deletes them. |

`scripts/build-world.mts` has no npm script on purpose. It regenerates the
coastline data in `src/lib/geo/`, takes a while, and its output is committed;
`src/lib/geo/world.test.ts` asserts the generated files still name it.
