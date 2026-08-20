import { describe, expect, it } from "vitest";
import {
  dueStage,
  EMPTY_STAGES_HOURS,
  MIN_GAP_HOURS,
  type NudgeCandidate,
} from "./nudges";

/**
 * The interval between two stages, in its own file.
 *
 * Split from `nudges.test.ts` because that file reached this project's
 * three-hundred-line ceiling, and this is the split the ceiling is asking
 * for: everything next door is about a single decision in isolation — which
 * track, which threshold, muted or revoked — and every one of those tests
 * leaves `last_sent_at` null. These are about the sequence as a sequence, and
 * about the one bug that only appears when a candidate is *behind* it.
 *
 * Worth stating plainly, because it is the failure this whole feature was
 * built to avoid: a threshold measured from the anchor stops pacing anything
 * once the anchor is older than the last threshold. Every remaining stage is
 * then due, permanently, and a daily cron delivers the rest of the sequence
 * one stage per morning — the six-stage empty track compressed into three
 * days, ending with a message that says it is the last one.
 */

const NOW = new Date("2026-08-19T09:00:00Z");

function hoursAgo(hours: number): Date {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000);
}

/** An invited photographer with nothing, invited long enough ago for stage 1. */
function candidate(overrides: Partial<NudgeCandidate> = {}): NudgeCandidate {
  return {
    created_at: hoursAgo(25),
    nudges_muted_at: null,
    revoked_at: null,
    photo_count: 0,
    published_count: 0,
    oldest_unpublished_at: null,
    empty_stage: 0,
    draft_stage: 0,
    last_sent_at: null,
    ...overrides,
  };
}

describe("the pace between two stages of one track", () => {
  /*
   * The bug this describes is the one the whole feature exists to avoid, and
   * it is invisible in every other test in this file because they all leave
   * `last_sent_at` null.
   *
   * A threshold is measured from the *anchor*, so once the anchor is older
   * than the last threshold every remaining stage is due at once and for
   * ever. Nothing but the 20-hour global floor then stands between the
   * recipient and one stage per morning until the track runs out — the exact
   * burst the seed migration and the monthly tail were designed to prevent,
   * arriving one day later instead.
   */

  it("does not send the whole monthly tail on consecutive mornings", () => {
    /*
     * The seeded contributor, on the first run after the migration: invited
     * a hundred days ago, stages 1-3 marked sent yesterday. Every remaining
     * threshold (888h, 1608h, 2328h) is already behind them, so without a
     * floor measured from the last send they receive stage 4 today, 5
     * tomorrow and 6 — "this is the last time we will mention it" — the
     * morning after.
     */
    const seeded = candidate({
      created_at: hoursAgo(2400),
      empty_stage: 3,
      last_sent_at: hoursAgo(24),
    });
    expect(dueStage(seeded, "empty", NOW)).toBeNull();
  });

  it("sends the next stage once its own interval has passed", () => {
    // The same person a month later. The tail is monthly, and it does arrive.
    const seeded = candidate({
      created_at: hoursAgo(2400),
      empty_stage: 3,
      last_sent_at: hoursAgo(EMPTY_STAGES_HOURS[3] - EMPTY_STAGES_HOURS[2]),
    });
    expect(dueStage(seeded, "empty", NOW)).toBe(4);
  });

  it("does not send all three draft stages on consecutive mornings", () => {
    /*
     * The draft track has no seed at all, so this one fires on the very first
     * production run: anybody sitting on an unpublished photograph older than
     * seven days has cleared all three thresholds, and would be told
     * "still nothing published?" on three consecutive days.
     */
    const drafter = candidate({
      photo_count: 1,
      oldest_unpublished_at: hoursAgo(400),
      draft_stage: 1,
      last_sent_at: hoursAgo(24),
    });
    expect(dueStage(drafter, "draft", NOW)).toBeNull();
  });

  it("still allows a few hours of cron drift", () => {
    /*
     * The same allowance `MIN_GAP_HOURS` makes, for the same reason: a 09:00
     * job that lands at 09:04 must not decide the interval is a few minutes
     * short and stay silent for another whole day — which on the monthly tail
     * would mean another month.
     */
    const seeded = candidate({
      created_at: hoursAgo(2400),
      empty_stage: 3,
      last_sent_at: hoursAgo(EMPTY_STAGES_HOURS[3] - EMPTY_STAGES_HOURS[2] - 1),
    });
    expect(dueStage(seeded, "empty", NOW)).toBe(4);
  });

  it("leaves the first stage of a track governed by the global floor alone", () => {
    /*
     * There is no previous stage on this track to measure from, so the only
     * rule that can apply is the 20-hour one. This is the track switch again:
     * an upload after two empty nudges starts the draft track at stage 1, and
     * it must not inherit an interval from the track it just left.
     */
    const switched = candidate({
      photo_count: 1,
      empty_stage: 2,
      oldest_unpublished_at: hoursAgo(25),
      last_sent_at: hoursAgo(MIN_GAP_HOURS),
    });
    expect(dueStage(switched, "draft", NOW)).toBe(1);
  });
});
