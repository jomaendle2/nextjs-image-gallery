/**
 * The shape a suggestion has by the time anybody sees it, and the two rules
 * that get it there.
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

/** Matches `MAX_TITLE` in `src/app/contribute/photos/actions.ts`. */
const MAX_TITLE = 120;
/** Matches `MAX_DESCRIPTION` there. */
const MAX_DESCRIPTION = 300;
/** The location field is saved under the title's cap; so is this. */
const MAX_LOCATION = 120;

/** Runs of whitespace a model may return, including the newlines. */
const WHITESPACE = /\s+/g;

/**
 * How sure the model claims to be that it can name the place.
 *
 * Asked for as a separate field rather than inferred from hedging in the
 * string itself ("possibly Cornwall?"), because a hedge in the text would
 * reach the form as part of the place name.
 */
export type LocationConfidence = "high" | "low";

/** What the model is asked to return, before anything has been done to it. */
export interface RawSuggestion {
  title: string;
  description: string;
  location: string | null;
  locationConfidence: LocationConfidence;
}

/** What the route returns. Same shape; every field already trustworthy. */
export interface PhotoSuggestion {
  title: string;
  description: string;
  location: string | null;
  locationConfidence: LocationConfidence;
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
function clamp(value: string, max: number): string {
  return value.replace(WHITESPACE, " ").trim().slice(0, max).trim();
}

/**
 * The model's answer, made safe to put in front of somebody.
 *
 * Two rules, and the second is the one worth arguing.
 *
 * **Every string is cut to its column's cap.** The caps live in the server
 * action that saves them; a suggestion longer than one would be silently
 * truncated at save time or rejected, and either is a worse way to find out
 * than never seeing the extra words.
 *
 * **A place the model is unsure of is dropped entirely.** A vision model will
 * name a beach it has never seen with complete composure, and `/globe` is
 * built from exactly these strings: a photograph filed under a coastline it
 * was not taken on is a wrong dot on a map that the person who was there did
 * not put it on. The suggestion is offered to somebody who *knows* the
 * answer, so the cost of dropping a right guess is that they type it — and
 * the cost of keeping a wrong one is that they confirm it, because a filled
 * field reads as a fact.
 *
 * The confidence itself is passed through rather than swallowed, so the
 * interface can say the place was left blank on purpose instead of appearing
 * to have found nothing.
 */
export function shapeSuggestion(raw: RawSuggestion): PhotoSuggestion {
  const location =
    raw.locationConfidence === "high" && raw.location !== null
      ? clamp(raw.location, MAX_LOCATION)
      : "";

  return {
    title: clamp(raw.title, MAX_TITLE),
    description: clamp(raw.description, MAX_DESCRIPTION),
    location: location === "" ? null : location,
    locationConfidence: raw.locationConfidence,
  };
}
