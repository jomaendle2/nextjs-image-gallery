/**
 * When — and whether — an invited photographer hears from the gallery again.
 *
 * Inserting a `contributors` row *is* the invitation: one email goes out with
 * a seven-day sign-in link, and after that the gallery never speaks again. A
 * photographer who meant to get to it at the weekend, or whose link expired
 * while they were away, silently becomes a dead row — an address, a slug, and
 * a `/by/<slug>` page with nothing on it.
 *
 * This file is the schedule and nothing else: no database, no clock of its
 * own, no I/O. It is the pattern `announcement.ts` and `announce-result.ts`
 * established, and the reason those two are the well-tested parts of the
 * codebase. Everything here is a decision, and a decision can be tabulated.
 *
 * The load-bearing property is that **every stop condition is a state check
 * at send time** — has a photo, has published, muted, revoked — rather than a
 * flag set when the sequence began. Someone who uploads between the day-3 and
 * the day-7 mail gets no day-7 mail, because the day-7 mail asks the question
 * again rather than trusting an answer recorded four days ago.
 */

/**
 * The empty track: invited, never uploaded anything.
 *
 * 24h, 3d, 7d while the invitation is still a live thought, then monthly
 * three times and stop. The monthly tail has to end, and that is not
 * politeness: mailing an address that has ignored five messages is the
 * fastest way to be filtered, and the filter applies to the announcement
 * list too — which is the mail that actually matters. So the sixth says
 * plainly that it is the last one, and there is no seventh.
 */
export const EMPTY_STAGES_HOURS = [24, 72, 168, 888, 1608, 2328] as const;

/**
 * The draft track: uploaded something, published none of it.
 *
 * Short on purpose. This is the highest-converting state there is — the
 * person already did the hard part, and a title away from live is a to-do
 * item rather than a re-engagement problem. Reminding somebody monthly for a
 * year about a photograph they already uploaded is nagging.
 */
export const DRAFT_STAGES_HOURS = [24, 72, 168] as const;

/**
 * No two nudges within this many hours, across *both* tracks.
 *
 * The tracks keep separate stage counters — a contributor who uploads after
 * two empty nudges starts the draft track at stage 1 — so without a global
 * floor the upload that moves them between tracks could earn them a second
 * mail the same morning. Twenty rather than twenty-four because the cron runs
 * daily and a run that drifted a few minutes later must not skip a day.
 */
export const MIN_GAP_HOURS = 20;

/**
 * How early a stage may arrive against the interval it owes.
 *
 * The same four hours `MIN_GAP_HOURS` already builds in, named once so the
 * two rules cannot drift apart. A daily 09:00 job does not run at 09:00: it
 * runs at 09:04, then at 08:58, and an interval demanding *exactly* 720
 * hours would find yesterday's send four minutes too recent and stay silent.
 * On the short thresholds that costs a day. On the monthly tail it costs a
 * month, and a "monthly" mail that lands every 31 or 32 days depending on
 * scheduler jitter is the kind of drift nobody notices until the sequence
 * takes half a year to finish.
 */
export const CRON_DRIFT_HOURS = 4;

export type NudgeTrack = "empty" | "draft";

/** One row of `listNudgeCandidates`, as the schedule needs to read it. */
export interface NudgeCandidate {
  /** When the contributors row was created — the empty track's anchor. */
  created_at: string | Date;
  /** Set by `/api/quiet`. Stops nudges and nothing else. */
  nudges_muted_at: string | Date | null;
  revoked_at: string | Date | null;
  photo_count: number;
  published_count: number;
  /** The draft track's anchor: the oldest photograph still unpublished. */
  oldest_unpublished_at: string | Date | null;
  /** Highest stage already sent on each track. Zero when none has been. */
  empty_stage: number;
  draft_stage: number;
  /** The most recent nudge on either track, for the global floor. */
  last_sent_at: string | Date | null;
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Neon's HTTP driver returns a timestamptz as a string, and tests hand us a
 * `Date`. Both have to work, and an unparseable value has to be treated as
 * "no anchor" rather than as `NaN` hours ago — which would compare false
 * against every threshold and quietly make somebody permanently ineligible.
 */
function toTime(value: string | Date | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

function hoursBetween(earlier: number, later: number): number {
  return (later - earlier) / HOUR_MS;
}

/**
 * Which sequence this candidate is in *right now*, or null for nobody.
 *
 * Read in this order and only this order: no photographs is the empty track;
 * photographs with nothing published is the draft track; anything published
 * at all and the sequence is over, because the thing it existed to cause has
 * happened. Publishing and then deleting every photograph does put somebody
 * back on a track, and that is correct — a `/by/<slug>` page with nothing on
 * it is the same dead end however it came to be one.
 */
export function nudgeTrack(candidate: NudgeCandidate): NudgeTrack | null {
  if (candidate.published_count > 0) {
    return null;
  }
  return candidate.photo_count === 0 ? "empty" : "draft";
}

function stagesFor(track: NudgeTrack): readonly number[] {
  return track === "empty" ? EMPTY_STAGES_HOURS : DRAFT_STAGES_HOURS;
}

function sentSoFar(candidate: NudgeCandidate, track: NudgeTrack): number {
  return track === "empty" ? candidate.empty_stage : candidate.draft_stage;
}

function anchorFor(
  candidate: NudgeCandidate,
  track: NudgeTrack,
): string | Date | null {
  return track === "empty"
    ? candidate.created_at
    : candidate.oldest_unpublished_at;
}

/**
 * The 1-based stage to send this candidate on this track, or null for none.
 *
 * Null covers six different situations on purpose, because the caller does
 * the same thing in all of them — nothing:
 *
 *   - they have asked for quiet (`nudges_muted_at`);
 *   - they have been revoked;
 *   - the track is exhausted, so the sequence has ended by itself;
 *   - there is no anchor to measure from;
 *   - the anchor is not yet old enough for the next stage;
 *   - another nudge went out inside `MIN_GAP_HOURS`;
 *   - the previous stage of this track went out too recently for this
 *     one, which is what keeps a late sequence paced rather than
 *     delivered all at once.
 *
 * A daily cron means "24h" is really "the first 09:00 run at least 24 hours
 * after the anchor". That is the desired behaviour rather than a rounding
 * error: nobody should be mailed at 03:00 because 03:00 is when they were
 * invited.
 */
export function dueStage(
  candidate: NudgeCandidate,
  track: NudgeTrack,
  now: Date,
): number | null {
  if (candidate.nudges_muted_at !== null || candidate.revoked_at !== null) {
    return null;
  }

  const stages = stagesFor(track);
  const next = sentSoFar(candidate, track) + 1;
  if (next < 1 || next > stages.length) {
    return null;
  }

  const anchor = toTime(anchorFor(candidate, track));
  if (anchor === null) {
    return null;
  }

  const threshold = stages[next - 1];
  if (threshold === undefined) {
    return null;
  }

  const at = now.getTime();
  if (hoursBetween(anchor, at) < threshold) {
    return null;
  }

  /*
   * The global floor, checked last: it is the cheapest rule to state and the
   * most expensive to leave out, and it has to apply even to a stage that is
   * otherwise perfectly due. Somebody who uploaded this morning after two
   * empty nudges is due for draft stage 1 by every other rule, and this is
   * the only thing standing between them and two emails in one day.
   */
  const lastSent = toTime(candidate.last_sent_at);
  if (lastSent !== null && hoursBetween(lastSent, at) < MIN_GAP_HOURS) {
    return null;
  }

  /*
   * The interval this stage owes the one before it, and the rule without
   * which the thresholds above do not actually pace anything.
   *
   * Every threshold is measured from the anchor, so the moment the anchor is
   * older than the *last* threshold, every remaining stage is due — and stays
   * due for ever. The global floor above then spaces them by twenty hours,
   * which is to say the daily cron walks the rest of the sequence one stage
   * per morning. A contributor invited last year would receive the entire
   * monthly tail, ending with "this is the last time we will mention it", in
   * the course of three days; a photographer sitting on a week-old draft
   * would get all three draft stages the same way, on the very first run,
   * because that track has no seed to start it further along.
   *
   * Measuring the gap between two adjacent thresholds and requiring it to
   * have elapsed *since the last send* makes the sequence keep its shape
   * however far behind it starts. Late is then simply late: the stages still
   * arrive a day, three days and a week apart, just beginning later than the
   * invitation did.
   *
   * Only from stage two onward. Stage one has no predecessor on this track,
   * and must not inherit an interval from the track somebody just left — an
   * upload after two empty nudges begins the draft track at stage 1, and the
   * twenty-hour floor is the whole of the rule there.
   */
  const previous = stages[next - 2];
  if (previous !== undefined && lastSent !== null) {
    const interval = threshold - previous - CRON_DRIFT_HOURS;
    if (hoursBetween(lastSent, at) < interval) {
      return null;
    }
  }

  return next;
}

/** A candidate row with the fields a message needs, not only a decision. */
export interface NudgeRecipient extends NudgeCandidate {
  id: string;
  email: string;
  display_name: string;
  /** Null for somebody who has never redeemed a link. */
  first_signed_in_at: string | Date | null;
  /** The oldest unpublished photograph, which the draft track's mail shows. */
  draft_url?: string | null;
  draft_description?: string | null;
}

/** One decided nudge: who, which sequence, which stage, and what to say. */
export interface PlannedNudge {
  id: string;
  email: string;
  displayName: string;
  track: NudgeTrack;
  stage: number;
  /** Unpublished photographs, for the draft track's copy. */
  drafts: number;
  hasSignedIn: boolean;
  /** Their oldest draft, shown in the message that is about it. */
  draftUrl: string | null;
  draftDescription: string | null;
}

/**
 * The whole run's plan, decided before anything is claimed or sent.
 *
 * Pure, and that is the point: this is the function `?dry=1` returns and the
 * one the real run acts on, so the list somebody inspects by hand the day
 * before is provably the list that goes out. Two code paths — one to preview
 * and one to send — would eventually disagree, and the disagreement would
 * only ever be discovered in somebody's inbox.
 */
export function planNudges(
  people: NudgeRecipient[],
  now: Date,
): PlannedNudge[] {
  return people.flatMap((person) => {
    const track = nudgeTrack(person);
    if (track === null) {
      return [];
    }
    const stage = dueStage(person, track, now);
    if (stage === null) {
      return [];
    }
    return [
      {
        id: person.id,
        email: person.email,
        displayName: person.display_name,
        track,
        stage,
        drafts: person.photo_count - person.published_count,
        hasSignedIn: person.first_signed_in_at !== null,
        draftUrl: person.draft_url ?? null,
        draftDescription: person.draft_description ?? null,
      },
    ];
  });
}
