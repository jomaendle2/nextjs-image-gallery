import type { PhotoSuggestion } from "@/lib/ai/suggestion";

/**
 * What a suggestion does to a form, decided away from the form.
 *
 * The route already returns text that is safe to show — `shapeSuggestion`
 * clamps every string to its column's cap and drops a place the model was
 * unsure of. What is left is the interface's own question: given that answer
 * and a form that may already have writing in it, which boxes are written
 * into, and what is the person told.
 *
 * Pure, and in its own file for the same reason `filter.ts` is: the component
 * that uses this reaches into the DOM by element id, which is untestable
 * without a browser, and the decision it is making is neither of those things.
 */

/**
 * The three fields a model is allowed to touch.
 *
 * Not the backdrop colour, which is measured from the pixels rather than
 * guessed at, and nothing inside the members-only fieldset: "where you stood"
 * and "how you made it" are the photographer's account of being somewhere,
 * and a model that was not there has nothing to say about either. The point
 * of that fieldset is that a person wrote it.
 *
 * Each name is also the id prefix its input uses in `PhotoEditForm`, which is
 * how the component finds them. `bg_color` is the field where those two
 * differ, and it is not in this list.
 */
export type FillableField = "title" | "description" | "location";

/**
 * The writes to make, in the order the fields appear on screen.
 *
 * Empty strings are left out rather than written, and that is the rule that
 * matters: `shapeSuggestion` returns `location: null` whenever the model
 * hedged about the place, and blanking a location the photographer had
 * already typed — because a model declined to guess it — would be the worst
 * thing this feature could do. A suggestion adds; it does not erase.
 */
const FILLABLE: readonly FillableField[] = ["title", "description", "location"];

export function fillsFrom(
  suggestion: Partial<PhotoSuggestion>,
): [FillableField, string][] {
  const writes: [FillableField, string][] = [];

  for (const field of FILLABLE) {
    const value = suggestion[field];
    /*
     * A string and not an empty one. Three states arrive here and only one is
     * a write: a field the model has not reached is `undefined`, a place it
     * declined to name is `null`, and both mean leave the box alone.
     */
    if (typeof value === "string" && value !== "") {
      writes.push([field, value]);
    }
  }

  return writes;
}

/**
 * Which field the model is on, so the wait can say something truer than
 * "Looking…".
 *
 * Read from what has arrived rather than counted: the fields come in schema
 * order, so the last one present is the one being written. It is a guess
 * about a stream rather than a message from the model, which is why it only
 * ever appears next to the fields themselves filling in — the sentence is the
 * caption, the fields are the evidence.
 */
export type SuggestionStage = "looking" | "title" | "description" | "location";

export function stageOf(partial: Partial<PhotoSuggestion>): SuggestionStage {
  if (typeof partial.location === "string" && partial.location !== "") {
    return "location";
  }
  if (partial.description !== undefined) {
    return "description";
  }
  if (partial.title !== undefined) {
    return "title";
  }
  return "looking";
}

const STAGE_LABEL: Record<SuggestionStage, string> = {
  looking: "Looking at the photograph…",
  title: "Naming it…",
  description: "Describing what is in the frame…",
  location: "Placing it…",
};

export function stageLabel(stage: SuggestionStage): string {
  return STAGE_LABEL[stage];
}

/** Every suggestion says this, because it is the thing worth being sure of. */
const NOTHING_SAVED =
  "Suggested by a model that looked at the photograph. Edit anything you " +
  "disagree with — nothing is saved until you press Save changes.";

/**
 * A blank location, said out loud rather than left to look like a failure.
 *
 * `shapeSuggestion` drops a place the model was not confident about, and its
 * comment explains why: `/globe` is built from these strings, and a wrong dot
 * is put on the map by the one person who knows it is wrong. But a field that
 * simply stays empty is indistinguishable from the feature half-working, so
 * the deliberate silence has to be reported as a decision.
 */
const NO_PLACE =
  " It would not guess where this was taken, so the location is untouched.";

export function suggestionNote(suggestion: PhotoSuggestion): string {
  return suggestion.locationConfidence === "high"
    ? NOTHING_SAVED
    : NOTHING_SAVED + NO_PLACE;
}
