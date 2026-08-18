import type { PhotoField } from "./actions";

/**
 * The field the last save refused, and where the sentence explaining it is.
 *
 * Passed around as one object rather than two values because the two are only
 * ever useful together: a field marked `aria-invalid` with no
 * `aria-describedby` tells somebody using a screen reader that something is
 * wrong and not what. WCAG 3.3.1 wants the identification and the
 * description, and they are one thought.
 *
 * In its own module because the two halves of the form now live in two files
 * and both need this. A type exported from one component for the other to
 * import makes the wrong one look like the owner.
 */
export interface Marks {
  field: PhotoField | undefined;
  messageId: string;
}

/**
 * The two attributes that make a refusal reach assistive technology.
 *
 * Absent rather than `aria-invalid={false}` on the fields that are fine: an
 * explicit false is legal and is also one more state to keep in step, and the
 * default is already "valid".
 */
export function marksFor(marks: Marks, field: PhotoField) {
  return marks.field === field
    ? { "aria-describedby": marks.messageId, "aria-invalid": true }
    : {};
}
