# Setup

Getting the site running, and every variable it reads.
[The runbook](runbook.md) covers operating it once it is up.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

Node 22.18 or newer, which is what `engines` in `package.json` says. Below
that, node does not strip types from `.mts` without a flag the scripts do not
pass, so every `db:*` and `smoke:*` command dies on a type annotation and
reads like a broken script rather than a wrong runtime.

CI and Vercel build on 24, and that is the version to develop against. The
floor is lower than the ceiling on purpose: `engines` is a hard gate — npm
warns on it and Vercel refuses a build that does not satisfy it — so it
states what actually breaks rather than what is preferred. Claiming 24 there
would fail a deployment on a platform still offering 22.

## The database and the photographs

```bash
vercel env pull .env.local   # DATABASE_URL, BLOB_READ_WRITE_TOKEN
npm run db:migrate           # additive, idempotent — re-running is a no-op
```

## Email

Sign-in links are printed to the server console until an email provider is
configured, which is enough for local development. For production:

```bash
vercel env add RESEND_API_KEY production
vercel env add EMAIL_FROM production      # a sender verified with Resend
vercel env add SITE_URL production        # https://your-domain
```

`SITE_URL` matters for more than tidiness. Sign-in links carry a token, and
building them from the request `Host` header would let anyone hitting the
sign-in form choose where an invited contributor's token gets delivered.

If no provider is configured yet, mint your own first link with
`npm run mint-link -- you@example.com`.

## Environment

| Variable | Required | What it is |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon connection string. |
| `BLOB_READ_WRITE_TOKEN` | yes | Vercel Blob store. Set automatically once the store is linked to the project. |
| `SITE_URL` | **production build fails without it** | Canonical origin. Every link the site emails is built from this and **never** from the request `Host` header, so a magic link cannot be pointed at an attacker's domain. Falls back to `VERCEL_PROJECT_PRODUCTION_URL`, then localhost — which is why production refuses to build without it rather than emailing people an unfamiliar domain. |
| `RESEND_API_KEY` | **production build fails without it** | In development a missing key prints messages to the terminal, which is how you read a sign-in link locally. In production it throws. |
| `EMAIL_FROM` | **production build fails without it** | The verified sender, e.g. `contact@thebeautyof.earth`. Required alongside the key: with either missing nothing sends. |
| `CRON_SECRET` | for the weekly reminder | Vercel sends it as `Authorization: Bearer …` to `/api/cron/announce-reminder`. Without it the route refuses to run rather than becoming a public way to ring the owner's inbox. |
| `AI_GATEWAY_API_KEY` | for suggested details | The Vercel AI Gateway key behind "Suggest details". **Set it explicitly in production.** Without it the code falls back to `VERCEL_OIDC_TOKEN`, which works on a linked machine and expires after hours — and the failure is silent: `aiSuggestionsConfigured()` simply stops returning true, the button stops rendering, and nobody is told the feature is gone. It is a spending credential, so set a budget on the gateway itself: the route's rate limit is per-instance and in-memory, which bounds requests per instance and not cost. |
| `MAPTILER_KEY` | for the map picker | Tiles for the location picker and the hint map. Without it both render a "map unavailable" notice and coordinates can still be typed by hand, so it degrades honestly — but the hint map is a blank panel. Read on the server and passed down as a prop, never as `NEXT_PUBLIC_*`, so the key stays out of every client bundle. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_MEMBERSHIP_PRICE_ID` | for membership | With any of them missing the membership offer is hidden and the webhook rejects events, rather than half-selling something. |
| `ALLOW_PREVIEW_MIGRATIONS` | no | Set to `1` on a preview branch to let `scripts/migrate.mts` run there. It refuses by default, because preview deployments share the production database until they do not. See [the roadmap](../roadmap.md). |
| `STAMP` | no | Names the snapshot `npm run recaption` writes under `docs/snapshots/` before it edits anything. Defaults to `run`. |

`vercel env pull .env.local` fetches the first two. Note that it **overwrites
the file wholesale** and defaults to the development environment — see
[the overview](../architecture/overview.md) for the rest of that trap.

## Checks

```bash
npm run typecheck   # the app, then scripts/ — two invocations, see toolchain.md
npm run lint        # Biome: lint, format check, import sorting
npm test            # Vitest
```

CI runs all three on every push and every pull request. What each is
configured to enforce, and what is deliberately turned off, is in
[toolchain.md](../architecture/toolchain.md).
