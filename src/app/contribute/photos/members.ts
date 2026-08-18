import type { OwnPhotoRow } from "@/lib/photos/types";

/**
 * What the members-only section is holding, said on the outside of it.
 *
 * The section is closed when a row opens, because most edits are a title and
 * a description and the three fields below them were making every form twice
 * as tall as the work being done in it. Closing something a photographer has
 * already filled in is only acceptable if the closed thing says so — a
 * collapsed box that looks identical whether it holds their notes or nothing
 * is how writing gets forgotten, and then overwritten.
 *
 * Pure and separate so the count can be checked without rendering a form.
 */

/**
 * The three the summary names. `is_specimen` is deliberately not among them:
 * it is a consent checkbox rather than something written, and "4 filled"
 * counting a tickbox alongside three pieces of prose would be a number about
 * nothing.
 */
export function filledMemberFields(photo: OwnPhotoRow): number {
  const written = [photo.precise_location, photo.technique].filter(
    (value) => (value ?? "").trim() !== "",
  ).length;

  /* One pin, whether or not both halves survived a partial write. */
  const pinned = photo.precise_lat !== null && photo.precise_lng !== null;

  return written + (pinned ? 1 : 0);
}

/**
 * The sentence on the closed summary.
 *
 * Names the fields when there are none, and counts them when there are. Those
 * are different questions: somebody who has never opened this needs to know
 * what is inside, and somebody who filled it in needs to know it is still
 * there.
 */
export function memberSummary(photo: OwnPhotoRow): string {
  const filled = filledMemberFields(photo);

  return filled === 0
    ? "Where you stood, the map pin, how you made it"
    : `${filled} of 3 filled`;
}
