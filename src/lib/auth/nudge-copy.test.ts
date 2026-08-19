import { describe, expect, it } from "vitest";
import {
  buildNudge,
  draftCopy,
  oneClickUnsubscribe,
  uploadCopy,
} from "./nudge-copy";
import { DRAFT_STAGES_HOURS, EMPTY_STAGES_HOURS } from "./nudges";

/**
 * What the nudges say, asserted rather than hoped for.
 *
 * These are the messages nobody asked to receive, which makes them the ones
 * whose rules have to be mechanical: one call to action, an opt-out a person
 * can find and a machine can use, and a last message that really is the last.
 * Every one of those is a promise made in prose somewhere else in this
 * codebase, and prose does not fail a build.
 */

const SIGN_IN = `https://example.test/contribute/verify?${new URLSearchParams({ token: "fixture" })}`;
const QUIET = `https://example.test/contribute/quiet?${new URLSearchParams({ token: "fixture" })}`;

const uploadStages = EMPTY_STAGES_HOURS.map((_hours, index) => index + 1);
const draftStages = DRAFT_STAGES_HOURS.map((_hours, index) => index + 1);

describe("every stage of the upload sequence", () => {
  it.each(uploadStages)("stage %i says something, briefly", (stage) => {
    const copy = uploadCopy("Anna Lindberg", stage, false);
    expect(copy.subject.length).toBeGreaterThan(0);
    expect(copy.lead.length).toBeGreaterThan(0);
    expect(copy.cta.length).toBeGreaterThan(0);
    // Two paragraphs is the ceiling. Past that it is an essay about somebody
    // else's hobby, arriving uninvited.
    expect(copy.detail.length).toBeLessThanOrEqual(2);
  });

  it.each(uploadStages)("stage %i carries exactly one link", (stage) => {
    /*
     * The one rule every stage shares. A second link is a second decision,
     * and a message with two asks is one somebody answers by closing it.
     * The links live in the renderer — sign-in and opt-out — so the *copy*
     * must contain none of its own.
     */
    const copy = uploadCopy("Anna", stage, false);
    const prose = [copy.subject, copy.lead, ...copy.detail, copy.cta].join(" ");
    expect(prose).not.toMatch(/https?:\/\//);
  });

  it("says different things to somebody who has signed in", () => {
    // "Your link is still good" and "you signed in, and the page is still
    // empty" are different messages to the same empty page.
    const cold = uploadCopy("Anna", 1, false);
    const warm = uploadCopy("Anna", 1, true);
    expect(warm.lead).not.toBe(cold.lead);
    expect(warm.lead).toContain("signed in");
  });

  it("answers the GPS objection at stage 2, where it belongs", () => {
    /*
     * The single most load-bearing sentence in the sequence: the reason
     * given most often for not uploading an original is that the file knows
     * where you live. Stage 1 asks; stage 2 answers the objection that stops
     * people acting on stage 1.
     */
    const copy = uploadCopy("Anna", 2, false);
    const prose = [copy.lead, ...copy.detail].join(" ");
    expect(prose).toMatch(/GPS/);
    expect(prose).toMatch(/never/i);
  });

  it("offers the invitations at stage 3 and nowhere earlier", () => {
    // The one place the gallery's own growth loop is mentioned — and it is
    // deliberately not in the first message, which has a different job.
    expect([
      uploadCopy("Anna", 1, false),
      uploadCopy("Anna", 2, false),
    ]).not.toContainEqual(
      expect.objectContaining({
        subject: expect.stringContaining("invitation"),
      }),
    );
    const third = uploadCopy("Anna", 3, false);
    expect([third.lead, ...third.detail].join(" ")).toMatch(/invitation/i);
  });

  it("says plainly that the last one is the last one", () => {
    /*
     * The promise the whole tail rests on. A sixth message that reads like
     * the fifth teaches somebody to filter the sender, and the filter would
     * catch the announcements too.
     */
    const last = uploadCopy("Anna", uploadStages.length, false);
    expect(`${last.subject} ${last.lead}`).toMatch(/last/i);
    // And it says the invitation itself survives, so stopping the mail does
    // not read as the door closing.
    expect(last.detail.join(" ")).toMatch(/does not expire|not expire/i);
  });

  it("greets by first name, however the display name is written", () => {
    expect(uploadCopy("Anna Lindberg", 1, false).lead).toMatch(/^Anna,/);
    expect(uploadCopy("  Anna  ", 1, false).lead).toMatch(/^Anna,/);
    // A name with no space at all still has to produce something addressable.
    expect(uploadCopy("Anna", 1, false).lead).toMatch(/^Anna,/);
  });
});

describe("every stage of the draft sequence", () => {
  it.each(draftStages)("stage %i counts the drafts correctly", (stage) => {
    const one = draftCopy("Anna", stage, 1);
    const many = draftCopy("Anna", stage, 3);

    // Several are always counted: "some photographs" gives somebody nothing
    // to check against what they remember uploading.
    expect(`${many.subject} ${many.lead}`).toContain("3 photographs");
    /*
     * One is never counted *wrongly*, which is the failure that matters.
     * "1 photographs" in a message about somebody's own work is the kind of
     * thing nobody notices in review and everybody notices in their inbox —
     * and "the 1 photograph" is only slightly better, which is why the last
     * stage says "the photograph" instead.
     */
    expect(`${one.subject} ${one.lead}`).toMatch(/\bphotograph\b/);
    expect(`${one.subject} ${one.lead}`).not.toContain("1 photographs");
  });

  it.each(draftStages)("stage %i carries exactly one link", (stage) => {
    const copy = draftCopy("Anna", stage, 2);
    const prose = [copy.subject, copy.lead, ...copy.detail, copy.cta].join(" ");
    expect(prose).not.toMatch(/https?:\/\//);
  });

  it("agrees with itself about number, in both directions", () => {
    expect(draftCopy("Anna", 1, 1).lead).toMatch(/it is not live/);
    expect(draftCopy("Anna", 1, 4).lead).toMatch(/they are not live/);
    expect(draftCopy("Anna", 1, 1).cta).toBe("Publish it");
    expect(draftCopy("Anna", 1, 4).cta).toBe("Publish them");
  });

  it("promises nothing is lost in the last one", () => {
    const last = draftCopy("Anna", draftStages.length, 2);
    expect(`${last.subject} ${last.lead}`).toMatch(/last/i);
    expect(last.detail.join(" ")).toMatch(/nothing is deleted/i);
  });
});

describe("buildNudge", () => {
  const message = buildNudge(uploadCopy("Anna", 1, false), SIGN_IN, QUIET);

  it("carries both links in both alternatives", () => {
    /*
     * A plain-text alternative that drops the opt-out is an opt-out that
     * only exists for people whose client renders HTML, which is not the
     * same as an opt-out.
     */
    expect(message.text).toContain(SIGN_IN);
    expect(message.text).toContain(QUIET);
    expect(message.html).toContain(`href="${SIGN_IN}"`);
    expect(message.html).toContain(`href="${QUIET}"`);
  });

  it("sets the RFC 8058 pair, both halves or neither", () => {
    expect(message.headers["List-Unsubscribe"]).toBe(`<${QUIET}>`);
    expect(message.headers["List-Unsubscribe-Post"]).toBe(
      "List-Unsubscribe=One-Click",
    );
  });

  it("points the header at the same URL the body offers", () => {
    // Two different opt-out links is how one of them silently stops working.
    expect(message.headers["List-Unsubscribe"]).toContain(QUIET);
  });

  it("renders a hostile display name inert", () => {
    /*
     * `display_name` is typed on the public apply form, so it reaches this
     * template from outside. The nudge is the one message somebody receives
     * months later, long after anybody would think to re-check.
     */
    const hostile = buildNudge(
      uploadCopy(`<img src=x onerror="alert(1)">`, 1, false),
      SIGN_IN,
      QUIET,
    );
    expect(hostile.html).not.toContain("<img");
    expect(hostile.html).not.toContain('onerror="');
    expect(hostile.html).toContain("&lt;img");
  });

  it("says what stops and what does not, in both alternatives", () => {
    // The narrowness is the point: somebody tired of being asked to upload
    // has not asked to be locked out of their own account.
    expect(message.text).toMatch(/Sign-in links.*unaffected/s);
    expect(message.html).toMatch(/Sign-in links[\s\S]*unaffected/);
  });

  it("puts one call-to-action button in the body and no other", () => {
    const buttons = message.html.match(/border-radius:999px/g) ?? [];
    expect(buttons).toHaveLength(1);
  });
});

describe("oneClickUnsubscribe", () => {
  it("wraps the URL in angle brackets, as the RFC requires", () => {
    expect(oneClickUnsubscribe("https://example.test/x")).toEqual({
      "List-Unsubscribe": "<https://example.test/x>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });
});
