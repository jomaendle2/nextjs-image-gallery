/**
 * How long each written field is allowed to be.
 *
 * One definition, because these numbers had grown three homes and two of them
 * documented the third in prose: `src/app/contribute/photos/actions.ts` held
 * the enforcing copy, `src/lib/ai/suggestion.ts` held a second set under
 * comments reading "Matches `MAX_TITLE` in …", and the inputs themselves held
 * none — which is why a long title was silently cut and the photographer told
 * "Changes saved."
 *
 * A plain module rather than an export from the action, because
 * `actions.ts` is `"use server"` and every export of such a file must be an
 * async function; a constant there cannot be shared at all. That constraint
 * is what let the copies appear in the first place.
 *
 * Three consumers now agree by construction: the server action clamps to
 * these, the model's answer is clamped to these before it reaches a field,
 * and the inputs stop the typing at them.
 */

/** A name for a photograph, not a sentence about it. */
export const MAX_TITLE = 120;

/** One plain sentence, read aloud to people who cannot see the photograph. */
export const MAX_DESCRIPTION = 300;

/** Room for a paragraph about how a photograph was made, not an essay. */
export const MAX_TECHNIQUE = 600;

/** A place as somebody writes it on a label. */
export const MAX_LOCATION = 120;
