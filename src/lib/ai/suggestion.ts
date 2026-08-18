/**
 * The shape a suggestion has by the time anybody sees it, and the rules that
 * get it there.
 *
 * Deliberately free of the SDK, of `process.env` and of anything async: what
 * happens to a model's answer between the provider and the form is the part
 * most worth pinning, and a pure function is the only kind a test can pin
 * without credentials. `suggestion.test.ts` is that test.
 *
 * Nothing here is ever written to the database. The route returns this to a
 * form, a photographer reads it, edits it, and the existing server action
 * saves it under its own caps. A suggestion is a draft of a sentence, not a
 * fact about a photograph.
 */

import { MAX_DESCRIPTION, MAX_LOCATION, MAX_TITLE } from "@/lib/photos/caps";
import type { Pin } from "@/lib/photos/types";

/** The location field is saved under the title's cap; so is this. */

/** One clause, said beside a chip. Long enough to name what was recognised. */
const MAX_REASON = 80;

/** Two guesses is a choice; three is a list nobody reads. */
const MAX_PLACES = 2;

/** Runs of whitespace a model may return, including the newlines. */
const WHITESPACE = /\s+/g;

/**
 * How sure the model claims to be that it can name the place.
 *
 * Asked for as a separate field rather than inferred from hedging in the
 * string itself ("possibly Cornwall?"), because a hedge in the text would
 * reach the form as part of the place name.
 *
 * It used to decide whether the answer was allowed on screen at all. It no
 * longer does, and that is the whole change: a guess nobody has to accept is
 * not a wrong dot on a map, so this now *labels* a chip instead of deleting
 * an answer. What made that safe is that nothing is written until a click.
 */
export type LocationConfidence = "high" | "low";

/** One candidate, as the model returns it. */
export interface RawPlace {
  confidence: LocationConfidence;
  name: string;
  reason: string;
  /**
   * Flat rather than a nested point, and the reason is streaming.
   *
   * A model emits keys one at a time, so a nested `{ lat, lng }` spends a
   * moment as an object with one number in it — a point that half exists.
   * Two sibling fields cannot: either both have arrived or the pair is not
   * a pair yet, and `readPoint` is the one place that decides which.
   */
  lat: number | null;
  lng: number | null;
}

/** What the model is asked to return, before anything has been done to it. */
export interface RawSuggestion {
  title: string;
  description: string;
  places: RawPlace[];
}

/**
 * The same answer, half-written.
 *
 * Every field optional and every string possibly a prefix, because that is
 * what a model streaming JSON actually produces: `{"title": "Low ti` is a
 * legitimate state of this object. An array in flight is worse still — its
 * elements arrive one at a time and the one being written may be a partial
 * object, or, for a moment, nothing at all. Nothing here has been validated
 * against anything; it exists to be shown, not to be kept.
 */
export interface PartialRawSuggestion {
  title?: string | undefined;
  description?: string | undefined;
  places?: (Partial<RawPlace> | undefined)[] | undefined;
}

/**
 * One candidate, made safe to put in front of somebody.
 *
 * The reason travels with the name because a chip that says only "Sagres,
 * Portugal" asks to be believed, and one that says "the lighthouse on the
 * headland" can be checked against the photograph the person took.
 */
export interface PlaceGuess {
  name: string;
  confidence: LocationConfidence;
  reason: string;
  /** Approximate, model-supplied, and null far more often than not. */
  point: Pin | null;
}

/** What the route returns. Same shape; every field already trustworthy. */
export interface PhotoSuggestion {
  title: string;
  description: string;
  /** Nought to two, most likely first. Empty is an honest answer. */
  places: PlaceGuess[];
}

/**
 * One field, trimmed of the whitespace a model likes to add and cut to the
 * cap the database column has.
 *
 * Cut rather than rejected. A suggestion that is four characters too long is
 * still a good suggestion, and answering a photographer with nothing because
 * the model was wordy would be the worse failure — they are going to edit
 * this text anyway.
 */
export function clamp(value: string, max: number): string {
  return value.replace(WHITESPACE, " ").trim().slice(0, max).trim();
}

/**
 * A coordinate from a model, believed only if it is one.
 *
 * Both numbers or neither, finite, and inside the range a coordinate has.
 * A model that writes `lat: 91` has written a sentence rather than a place,
 * and a chip whose point is dropped still fills the text field — the name
 * and the pin are two separate offers, and only one of them fails here.
 */
function readPoint(lat: unknown, lng: unknown): Pin | null {
  if (typeof lat !== "number" || typeof lng !== "number") {
    return null;
  }
  if (!(Number.isFinite(lat) && Number.isFinite(lng))) {
    return null;
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }
  return { lat, lng };
}

/**
 * The candidates, clamped, filtered and capped.
 *
 * **A blank name is dropped**, because the chip is the name — there is
 * nothing to click on and nothing to fill a field with. **A low confidence
 * is kept**, which is the reversal at the centre of this feature: the
 * verdict is printed on the chip, and a hedged guess somebody has to accept
 * before it goes anywhere costs nothing to show. **Two at most**, in the
 * order given, because the model was asked for the likeliest first.
 */
function shapePlace(entry: Partial<RawPlace> | undefined): PlaceGuess | null {
  if (entry === undefined || typeof entry.name !== "string") {
    return null;
  }
  const name = clamp(entry.name, MAX_LOCATION);
  if (name === "") {
    return null;
  }
  return {
    name,
    confidence: entry.confidence === "high" ? "high" : "low",
    reason:
      typeof entry.reason === "string" ? clamp(entry.reason, MAX_REASON) : "",
    point: readPoint(entry.lat, entry.lng),
  };
}

function shapePlaces(
  raw: readonly (Partial<RawPlace> | undefined)[],
): PlaceGuess[] {
  return raw
    .map(shapePlace)
    .filter((entry): entry is PlaceGuess => entry !== null)
    .slice(0, MAX_PLACES);
}

/**
 * A half-written answer, made safe to put in front of somebody.
 *
 * Absent fields stay absent rather than becoming empty strings. The caller
 * writes what it is given, so a `""` here would blank a box the model has
 * simply not reached yet.
 *
 * A place is emitted only once it has a name. The old rule here withheld the
 * place until a confidence had arrived, so that a guess the model was about
 * to disown could not appear in a field and be read; that is no longer the
 * question, because a chip is not a field. What is left is only that a
 * half-typed name should not flicker on a button — so `shapePlaces` drops a
 * nameless entry, and the chip appears when there is something to click.
 */
export function shapePartial(
  raw: PartialRawSuggestion,
): Partial<PhotoSuggestion> {
  const partial: Partial<PhotoSuggestion> = {};

  if (raw.title !== undefined) {
    partial.title = clamp(raw.title, MAX_TITLE);
  }
  if (raw.description !== undefined) {
    partial.description = clamp(raw.description, MAX_DESCRIPTION);
  }
  if (raw.places !== undefined) {
    partial.places = shapePlaces(raw.places);
  }

  return partial;
}

export function shapeSuggestion(raw: RawSuggestion): PhotoSuggestion {
  return {
    title: clamp(raw.title, MAX_TITLE),
    description: clamp(raw.description, MAX_DESCRIPTION),
    places: shapePlaces(raw.places ?? []),
  };
}

/**
 * A usable answer out of a run that did not finish, or nothing.
 *
 * The rule is that a salvaged suggestion has to be *whole* in the two fields
 * that get written into the form. A title with no description would leave the
 * photographer with half a caption and no indication that anything went
 * wrong — worse than the honest refusal, because it looks like the model's
 * considered answer. Both or neither.
 *
 * Places are dropped rather than salvaged even when present. A partial place
 * name is a prefix — "Nusa Pen" — and unlike the two sentences it is offered
 * as a button that writes a location, so a truncated one becomes a wrong
 * place on the globe. The chips are the one thing here worth losing.
 *
 * `shapeSuggestion` still does the clamping, so a salvaged answer obeys the
 * same limits as a finished one.
 */
export function salvage(
  latest: PartialRawSuggestion | null,
): PhotoSuggestion | null {
  const title = latest?.title?.trim() ?? "";
  const description = latest?.description?.trim() ?? "";

  if (title === "" || description === "") {
    return null;
  }

  return shapeSuggestion({ title, description, places: [] });
}
