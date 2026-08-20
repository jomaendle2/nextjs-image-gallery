import { describe, expect, it } from "vitest";
import {
  DRAFT_STAGES_HOURS,
  dueStage,
  EMPTY_STAGES_HOURS,
  MIN_GAP_HOURS,
  type NudgeCandidate,
  nudgeTrack,
} from "./nudges";

/**
 * The schedule, boundary by boundary.
 *
 * This file is the whole reason the schedule is a pure function. The cron
 * route around it needs a database, a mail provider and a clock; the decision
 * of *whether to mail somebody at all* needs none of the three, and it is the
 * half where a mistake is unrecoverable — an email cannot be edited after it
 * has arrived, and one sent to somebody who asked for quiet is a complaint
 * rather than a bug report.
 *
 * Table-driven because the interesting content is the table: six thresholds
 * on one track and three on the other, each of which has to be exclusive at
 * the boundary in exactly one direction.
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

describe("nudgeTrack", () => {
  it("puts somebody with no photographs on the empty track", () => {
    expect(nudgeTrack(candidate())).toBe("empty");
  });

  it("moves them to the draft track the moment they upload", () => {
    expect(nudgeTrack(candidate({ photo_count: 1 }))).toBe("draft");
  });

  it("takes them off both tracks the moment they publish", () => {
    /*
     * The point of the whole feature: one published photograph and the
     * sequence is over, mid-sequence, without anything having been flagged
     * when it began. Someone who publishes between the day-3 and the day-7
     * mail gets no day-7 mail.
     */
    expect(
      nudgeTrack(candidate({ photo_count: 3, published_count: 1 })),
    ).toBeNull();
  });

  it("returns somebody who deleted everything to the empty track", () => {
    // A `/by/<slug>` page with nothing on it is the same dead end however it
    // came to be one.
    expect(nudgeTrack(candidate({ photo_count: 0, published_count: 0 }))).toBe(
      "empty",
    );
  });
});

describe("dueStage on the empty track", () => {
  /*
   * Every threshold, from both sides. The `-1` case is the one that matters:
   * a daily cron that fired an hour early would otherwise send the whole
   * sequence a day ahead of what the copy promises.
   */
  const table = EMPTY_STAGES_HOURS.map((hours, index) => ({
    stage: index + 1,
    hours,
    already: index,
  }));

  it.each(table)(
    "sends stage $stage once the invitation is $hours hours old",
    ({ stage, hours, already }) => {
      const person = candidate({
        created_at: hoursAgo(hours),
        empty_stage: already,
      });
      expect(dueStage(person, "empty", NOW)).toBe(stage);
    },
  );

  it.each(table)(
    "holds stage $stage back an hour short of $hours",
    ({ hours, already }) => {
      const person = candidate({
        created_at: hoursAgo(hours - 1),
        empty_stage: already,
      });
      expect(dueStage(person, "empty", NOW)).toBeNull();
    },
  );

  it("stops for good after the last stage", () => {
    /*
     * The tail has to end. Mailing an address that ignored six messages is
     * the fastest way to be filtered, and the filter applies to the
     * announcement list — the mail that actually matters.
     */
    const person = candidate({
      created_at: hoursAgo(10_000),
      empty_stage: EMPTY_STAGES_HOURS.length,
    });
    expect(dueStage(person, "empty", NOW)).toBeNull();
  });

  it("never skips a stage, however old the invitation is", () => {
    // Six months of silence still gets stage 1 next, not stage 6: the copy
    // escalates in specificity, and the stages read as a sequence or not at
    // all.
    const person = candidate({ created_at: hoursAgo(10_000) });
    expect(dueStage(person, "empty", NOW)).toBe(1);
  });
});

describe("dueStage on the draft track", () => {
  function drafter(overrides: Partial<NudgeCandidate> = {}): NudgeCandidate {
    return candidate({
      photo_count: 2,
      oldest_unpublished_at: hoursAgo(25),
      ...overrides,
    });
  }

  const table = DRAFT_STAGES_HOURS.map((hours, index) => ({
    stage: index + 1,
    hours,
    already: index,
  }));

  it.each(table)(
    "sends stage $stage once the draft is $hours hours old",
    ({ stage, hours, already }) => {
      const person = drafter({
        oldest_unpublished_at: hoursAgo(hours),
        draft_stage: already,
      });
      expect(dueStage(person, "draft", NOW)).toBe(stage);
    },
  );

  it.each(table)(
    "holds stage $stage back an hour short of $hours",
    ({ hours, already }) => {
      const person = drafter({
        oldest_unpublished_at: hoursAgo(hours - 1),
        draft_stage: already,
      });
      expect(dueStage(person, "draft", NOW)).toBeNull();
    },
  );

  it("ends after three, where the empty track goes monthly", () => {
    const person = drafter({
      oldest_unpublished_at: hoursAgo(10_000),
      draft_stage: DRAFT_STAGES_HOURS.length,
    });
    expect(dueStage(person, "draft", NOW)).toBeNull();
  });

  it("measures from the draft, not from the invitation", () => {
    /*
     * Somebody invited a year ago who uploaded this morning is at the
     * *beginning* of the draft track, not past the end of it. Anchoring on
     * `created_at` here would mail all three stages on consecutive days.
     */
    const person = drafter({
      created_at: hoursAgo(9000),
      oldest_unpublished_at: hoursAgo(2),
    });
    expect(dueStage(person, "draft", NOW)).toBeNull();
  });

  it("sends nothing when there is no draft to measure from", () => {
    // Defensive: a `photo_count` above zero with no unpublished row should be
    // impossible, and if the query ever makes it possible the answer is
    // silence rather than a mail anchored on nothing.
    const person = drafter({ oldest_unpublished_at: null });
    expect(dueStage(person, "draft", NOW)).toBeNull();
  });
});

describe("the counters are per track", () => {
  it("starts the draft track at stage 1 for somebody two empty nudges in", () => {
    /*
     * The track switch, which is the case a single shared counter would get
     * wrong in the most visible way: a photographer who finally uploads after
     * two silent weeks would receive draft stage 3 — "still nothing
     * published?" — as the first thing the gallery said about their upload.
     */
    const person = candidate({
      photo_count: 1,
      empty_stage: 2,
      draft_stage: 0,
      oldest_unpublished_at: hoursAgo(25),
      last_sent_at: hoursAgo(48),
    });
    expect(nudgeTrack(person)).toBe("draft");
    expect(dueStage(person, "draft", NOW)).toBe(1);
  });
});

describe("the global floor between any two nudges", () => {
  it("holds an otherwise-due stage back inside the window", () => {
    const person = candidate({
      photo_count: 1,
      empty_stage: 2,
      oldest_unpublished_at: hoursAgo(25),
      last_sent_at: hoursAgo(MIN_GAP_HOURS - 1),
    });
    expect(dueStage(person, "draft", NOW)).toBeNull();
  });

  it("lets it through once the window has passed", () => {
    const person = candidate({
      photo_count: 1,
      empty_stage: 2,
      oldest_unpublished_at: hoursAgo(25),
      last_sent_at: hoursAgo(MIN_GAP_HOURS),
    });
    expect(dueStage(person, "draft", NOW)).toBe(1);
  });

  it("is under a day, so a cron that drifts later does not skip one", () => {
    // A daily job whose 09:00 run lands at 09:04 must not find yesterday's
    // mail "less than 24 hours ago" and stay silent for a whole day.
    expect(MIN_GAP_HOURS).toBeLessThan(24);
  });
});

describe("the two ways to stop hearing from the gallery", () => {
  it("sends nothing to somebody who asked for quiet", () => {
    const person = candidate({ nudges_muted_at: hoursAgo(100) });
    expect(dueStage(person, "empty", NOW)).toBeNull();
  });

  it("sends nothing to somebody who has been revoked", () => {
    const person = candidate({ revoked_at: hoursAgo(100) });
    expect(dueStage(person, "empty", NOW)).toBeNull();
  });

  it("checks both at send time, not when the sequence started", () => {
    // Muting mid-sequence stops the rest of it. That is the whole contract
    // the unsubscribe header in every message is making.
    const person = candidate({
      created_at: hoursAgo(10_000),
      empty_stage: 3,
      nudges_muted_at: hoursAgo(1),
    });
    expect(dueStage(person, "empty", NOW)).toBeNull();
  });
});

describe("timestamps as the driver actually returns them", () => {
  it("reads an ISO string exactly like a Date", () => {
    // Neon's HTTP driver returns timestamptz as a string; the tests above
    // hand it `Date`. A schedule that worked only for one of the two would
    // pass every test here and send nothing in production.
    const asString = candidate({ created_at: hoursAgo(25).toISOString() });
    expect(dueStage(asString, "empty", NOW)).toBe(1);
  });

  it("treats an unparseable anchor as no anchor, not as long ago", () => {
    const broken = candidate({ created_at: "not a date" });
    expect(dueStage(broken, "empty", NOW)).toBeNull();
  });
});

describe("the shape of the schedule itself", () => {
  it("escalates: every stage waits longer than the one before it", () => {
    for (const stages of [EMPTY_STAGES_HOURS, DRAFT_STAGES_HOURS]) {
      const sorted = [...stages].sort((a, b) => a - b);
      expect([...stages]).toEqual(sorted);
      expect(new Set(stages).size).toBe(stages.length);
    }
  });

  it("keeps the draft track shorter than the empty one", () => {
    /*
     * A stalled draft is a to-do item, not a re-engagement problem. If this
     * ever inverts, somebody is being reminded monthly for a year about a
     * photograph they already uploaded.
     */
    expect(DRAFT_STAGES_HOURS.length).toBeLessThan(EMPTY_STAGES_HOURS.length);
  });

  it("ends the monthly tail rather than running forever", () => {
    const last = EMPTY_STAGES_HOURS.at(-1);
    expect(last).toBeDefined();
    // Roughly three months, and then nothing. The last message says so.
    expect(last).toBeLessThan(24 * 100);
  });
});
