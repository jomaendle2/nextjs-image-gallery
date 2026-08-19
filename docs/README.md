# Documentation

Three kinds of document, kept apart on purpose: what the thing *is*, what you
*do* with it, and what it *was*. [`AGENTS.md`](../AGENTS.md) at the repository
root is the map into all of it and should stay short enough to read before
deciding where to go.

## Architecture — how it is built, and why

Durable. Changes when the system does.

| Document | Read it when |
| --- | --- |
| [architecture/overview.md](architecture/overview.md) | You need to know which part owns what, and where it is configured |
| [architecture/security.md](architecture/security.md) | You are touching auth, payments, location, or anything a stranger can reach. Numbered invariants, each enforced by a test |
| [architecture/data-model.md](architecture/data-model.md) | You are changing the schema, or wondering what a column is for |
| [architecture/toolchain.md](architecture/toolchain.md) | A lint rule is in your way, or you want to turn one on |
| [../DESIGN.md](../DESIGN.md) | You are writing a component or choosing a colour |

## Operations — how to run it and change it

Procedural. Changes when a workflow does.

| Document | Read it when |
| --- | --- |
| [operations/setup.md](operations/setup.md) | Setting the project up, or looking for what an environment variable does |
| [operations/runbook.md](operations/runbook.md) | Signing in as admin, publishing, announcing, refunding, erasing somebody, or running anything destructive |
| [operations/scripts.md](operations/scripts.md) | Looking for the command that does the thing |
| [operations/contributing-photos.md](operations/contributing-photos.md) | A photographer asked how any of this works |

## Ahead and behind

| Document | Read it when |
| --- | --- |
| [roadmap.md](roadmap.md) | Deciding what is next. Everything deliberately not done, with the condition that would change that |
| [archive/README.md](archive/README.md) | You want to know *why* something is the way it is. Finished audits, reviews and plans |

---

## Adding a document

Put it in the folder that matches how it will be *read*, not what it is
about: a page somebody follows step by step belongs in `operations/` even if
its subject is the database.

Then link it from the table above — a document nothing links to is one nobody
will find and nobody will update, and `docs-tree.test.ts` fails on orphans
for that reason. The same test holds every path mentioned in prose, every
relative link, and every `docs/…` path named in a code comment, so a document
that moves cannot leave a dangling pointer behind it.

Two habits keep the rest honest:

**One canonical home per checkable fact.** A number, a variable name, a
threshold — state it once and link to it from anywhere else that needs it.
The magic-link rationale was told six times and the environment variables
four; that is how one copy comes to say fifteen minutes while the constant
says sixty.

**Interpolate rather than retype.** Where prose quotes a value the code owns,
name the constant. `LOGIN_TTL_MINUTES` and `MAX_UPLOAD_BYTES` are done that
way already, and `security-copy.test.ts` keeps them that way.
