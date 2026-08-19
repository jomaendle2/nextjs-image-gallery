# Archive

Finished records. **Nothing here describes the current state of the system**
— each was true on the date it names and has not been maintained since.

They are kept because the reasoning outlives the state. Each was expensive to
produce, each explains a decision that still constrains the code, and a
paragraph saying *why* a threshold is 300 is worth more than the git log
entry that set it. What each of them established that is still live has been
moved out into the living documentation; what is left is the working.

Everything else in the checks treats these as history: the tests that hold
prose to the code exempt this folder, because editing a record to keep a test
quiet is falsifying it. Links are still checked — a link that 404s is broken
however old the page is.

| Record | Dated | What it was |
| --- | --- | --- |
| [2026-08-launch-checklist.md](2026-08-launch-checklist.md) | August 2026 | What had to be configured before the site was shared. Written while the whole site still lived on a branch; that branch merged, and most of the list is struck through. Its operator procedures — backups, re-coarsening, erasure — now live in [the runbook](../operations/runbook.md). |
| [2026-08-quality-audit.md](2026-08-quality-audit.md) | August 2026 | Seven production-readiness passes: what to build next, what a membership should sell, and the scaling limits measured rather than guessed. Several of its recommendations were later reversed — it argues against building the paid tier that now exists. The measurements it took are in [the roadmap](../roadmap.md). |
| [2026-08-security-review.md](2026-08-security-review.md) | 15 August 2026 | A review of the payment and membership surface: the threat model, what held, and fifteen defects across two rounds. What it found is now [security.md](../architecture/security.md), where the invariants are numbered and enforced by tests. |
| [2026-08-15-community-contributors-spec.md](2026-08-15-community-contributors-spec.md) | 15 August 2026 | The design for opening the gallery to invited photographers. Its schema is roughly fourteen columns and four tables behind what shipped; [data-model.md](../architecture/data-model.md) is current. |
| [2026-08-15-community-contributors-plan.md](2026-08-15-community-contributors-plan.md) | 15 August 2026 | The eleven-task implementation plan for the same. Every checkbox in it is unticked and every task shipped — it was worked from, not updated. |
