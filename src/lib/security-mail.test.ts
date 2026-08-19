import { describe, expect, it } from "vitest";
import { read } from "./source-text";

/**
 * The invariant that only the nudges have to satisfy, in its own file.
 *
 * `security.test.ts` is at this project's ceiling on file length, and the
 * split follows the one already made for the copy, interface, location and
 * membership invariants: one file per area, each read on its own when
 * somebody is changing that area. Nothing here is weaker for living apart —
 * `npm test` runs every file, and the reason this one exists is written
 * below.
 */

/**
 * Where the reminders meet two invariants that already existed.
 *
 * Here rather than in `security.test.ts` for the reason the copy, interface,
 * location and membership files exist: an invariant is read when somebody
 * changes the thing it guards, and these guard the nudges.
 */
describe("I1 and I11, where the reminders touch them", () => {
  it("the reminder opt-out opens a page, not a mutating handler", () => {
    // The third link this site puts in an inbox, and the third time this
    // rule has to be stated. Same failure, same shape: a scanner presses it.
    const page = read("app", "contribute", "quiet", "page.tsx");
    expect(page).toContain("<form");
    expect(page).not.toMatch(/await\s+muteNudges\(/);
  });

  it("the one-click unsubscribe endpoint exports no GET", () => {
    /*
     * `/api/quiet` is the RFC 8058 endpoint, which exists to be called by a
     * mail client unattended. That is exactly the shape a link scanner would
     * also reach, so the POST-only rule matters more here than anywhere: it
     * is the one URL in these messages that is *meant* to be machine-called.
     */
    const route = read("app", "api", "quiet", "route.ts");
    expect(route).toMatch(/export\s+async\s+function\s+POST/);
    expect(route).not.toMatch(/export\s+(async\s+)?function\s+GET/);
  });

  /*
   * The cron that mails photographers is neither limited nor owner-only, and
   * cannot be either: nobody is holding it, and a limiter keyed on what would
   * only measure the schedule against itself. Three other things bound it
   * instead, and this is where they are written down.
   */
  it("the nudge cron is bounded by a secret, a cap and a ledger", () => {
    const route = read("app", "api", "cron", "nudge-contributors", "route.ts");
    // The bearer check, before anything reads the database.
    expect(route).toMatch(/CRON_SECRET[\s\S]{0,400}status: 401/);
    // A ceiling on one run, so a first run against an accumulated list is
    // not a burst at the provider.
    expect(route).toMatch(/MAX_PER_RUN\s*=\s*\d+/);
    // And the claim, which is what makes a retry send nothing.
    expect(route).toMatch(/claimNudge\([\s\S]{0,120}\)/);
  });
});

describe("I17 — unasked-for mail carries a way out", () => {
  /*
   * The nudges are the only messages this site sends that nobody requested:
   * a subscriber opted in twice, a member paid, an applicant applied, and a
   * sign-in link answers something somebody just typed. A reminder to publish
   * answers nothing — so it needs an opt-out that a person can press and a
   * mail client can call, and it needs both or the reader's alternative is
   * the spam button, which costs the whole domain.
   */
  it("every nudge is built with the RFC 8058 header pair", () => {
    const copy = read("lib", "auth", "nudge-copy.ts");
    expect(copy).toContain("List-Unsubscribe");
    expect(copy).toContain("List-Unsubscribe-Post");
    // Attached by the builder rather than by each caller, so a new nudge
    // cannot be written without one.
    expect(copy).toMatch(/headers: oneClickUnsubscribe\(quietUrl\)/);
  });

  it("both nudge senders go through that builder", () => {
    const email = read("lib", "auth", "email.ts");
    const senders = email.slice(
      email.indexOf("export async function sendUploadNudge"),
    );
    expect(senders).toMatch(/sendUploadNudge[\s\S]*buildNudge\(/);
    expect(senders).toMatch(/sendDraftNudge[\s\S]*buildNudge\(/);
  });

  it("the opt-out is in the plain-text alternative too", () => {
    // An opt-out that only exists in the HTML part is an opt-out that only
    // exists for some readers, which is not one.
    const copy = read("lib", "auth", "nudge-copy.ts");
    expect(copy).toMatch(/No more of these[\s\S]{0,80}\$\{quietUrl\}/);
  });
});
