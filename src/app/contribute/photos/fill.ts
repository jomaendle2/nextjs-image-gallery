import type { PhotoSuggestion, PlaceGuess } from "@/lib/ai/suggestion";

/**
 * What a suggestion does to a form, decided away from the form.
 *
 * The route already returns text that is safe to show — `shapeSuggestion`
 * clamps every string to its column's cap. What is left is the interface's
 * own question: given that answer and a form that may already have writing
 * in it, which boxes are written into, and what is the person told.
 *
 * Pure, and in its own file for the same reason `filter.ts` is: the component
 * that uses this reaches into the DOM by element id, which is untestable
 * without a browser, and the decision it is making is neither of those things.
 */

/**
 * The two fields a model is allowed to write into by itself.
 *
 * It was three. The place has left this list, and that is the change this
 * feature is: candidates arrive as chips under the Location field and go
 * nowhere until one is clicked, so nothing writes a place except a person.
 * That also deletes the rule this file used to be mostly about — a `null`
 * location had to be distinguished from an empty one so that a declined
 * guess could not blank a location somebody had typed, and there is no
 * declined guess to handle any more.
 *
 * Not the backdrop colour, which is measured from the pixels rather than
 * guessed at, and nothing inside the members-only fieldset: "where you
 * stood" and "how you made it" are the photographer's account of being
 * somewhere, and a model that was not there has nothing to say about either.
 *
 * Each name is also the id prefix its input uses in `PublicFields`, which is
 * how the component finds them.
 */
export type FillableField = "title" | "description";

/**
 * Everything this feature can change, which is more than it fills.
 *
 * Undo has to cover a place a photographer accepted from a chip and a pin
 * they let it drop, neither of which is written automatically. `pin` is the
 * coordinate field inside the picker, which is controlled and therefore put
 * back through a prop rather than through the DOM — the one entry here that
 * is not an element id.
 */
export type TouchedField = FillableField | "location" | "pin";

/**
 * The writes to make, in the order the fields appear on screen.
 *
 * Empty strings are left out rather than written. A suggestion adds; it does
 * not erase.
 */
const FILLABLE: readonly FillableField[] = ["title", "description"];

export function fillsFrom(
  suggestion: Partial<PhotoSuggestion>,
): [FillableField, string][] {
  const writes: [FillableField, string][] = [];

  for (const field of FILLABLE) {
    const value = suggestion[field];
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
  /*
   * The stage survives the change, and its meaning moves with the feature:
   * it used to mean "writing a place into the field" and now means "listing
   * the places it can offer". Either way it is the last thing that happens,
   * and either way the label under the button is describing what is
   * appearing on screen at that moment.
   */
  if (partial.places !== undefined && partial.places.length > 0) {
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
  location: "Working out where…",
};

export function stageLabel(stage: SuggestionStage): string {
  return STAGE_LABEL[stage];
}

/**
 * Every suggestion says this, because it is the thing worth being sure of.
 *
 * It is now the whole of what is said. The sentence that used to follow it —
 * reporting that a place had been withheld — has gone, because nothing is
 * withheld any more: what the model found is on screen as chips, including
 * the guesses it is unsure of, and an empty row of chips says "nothing in
 * this frame points anywhere" without needing a caption to explain a
 * silence.
 */
const NOTHING_SAVED =
  "Suggested by a model that looked at the photograph. Edit anything you " +
  "disagree with — nothing is saved until you press Save changes.";

export function suggestionNote(): string {
  return NOTHING_SAVED;
}

/**
 * The place to write into an empty Location field without a click, or null.
 *
 * `PlaceChoices` was built on "the guess lands on a button, not in a box",
 * and that rule was written when the box might hold something. When the box
 * is empty and the model said `high`, the choice on offer was "click the
 * obviously right chip or leave a blank" — a click carrying no information.
 * The consent already happened: pressing "Suggest details" is the ask, and
 * this is part of the answer arriving.
 *
 * The two guards carry the old rule's remaining weight. A field with
 * anything in it is never touched — a typed word beats a guess — and a `low`
 * guess still lands on a chip, because "less sure" written into a field
 * reads as a fact once it is there.
 */
export function locationToFill(
  places: readonly PlaceGuess[],
  currentValue: string,
): string | null {
  const [top] = places;
  return top !== undefined &&
    top.confidence === "high" &&
    currentValue.trim() === ""
    ? top.name
    : null;
}

/** The id prefix the coordinate field uses, which is not its field name. */
const PIN_PREFIX = "pin";

/**
 * One of the edit form's inputs, found by id — the same mechanism
 * `PhotoEditForm` uses to move the cursor to a refused field.
 *
 * Here rather than in `useSuggestion`, because the mapping from a
 * `TouchedField` to an element id is the same knowledge as the `TouchedField`
 * union itself, and that lives here. The hook is left holding the part with a
 * shape worth reading on its own: a stream arriving into boxes somebody may
 * already have typed in.
 *
 * The `instanceof` pair is not ceremony. `getElementById` will happily return
 * whatever else has claimed that id, and writing `.value` onto an element
 * with no such property fails silently and for ever.
 */
export function fieldElement(
  field: TouchedField,
  photoId: string,
): HTMLInputElement | HTMLTextAreaElement | null {
  const prefix = field === "pin" ? PIN_PREFIX : field;
  const element = document.getElementById(`${prefix}-${photoId}`);
  return element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
    ? element
    : null;
}
