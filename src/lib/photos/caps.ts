/**
 * The limits a submission is held to.
 *
 * Field lengths for most of it, and the upload cap at the bottom — which is
 * not a length and not written text, so the module's subject is stated
 * wider than "how long each written field is allowed to be". What the two
 * kinds share is the only thing that matters here: each is enforced in more
 * than one place, and each was wrong in at least one of them before it had a
 * single home.
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

/**
 * The largest original the site will accept, in bytes.
 *
 * Here for the reason the text limits are here: this number had grown three
 * homes — the token route, the draft route and the upload form — and the
 * string "25 MB" had grown five more, in two sentences on screen, two error
 * messages and the contributor guide. Raising it meant editing eight places
 * and being right in all of them.
 *
 * Only one of the three enforces anything a client cannot skip: the token
 * route bakes it into the signed token, so Blob refuses the request itself.
 * The draft route's two checks are belt-and-braces against a blob that
 * arrived another way, and the form's is advisory — it exists so a
 * photographer learns the file is too big before waiting for the upload.
 *
 * Raising the cap changes nothing about what a visitor receives. A 60 MB
 * original becomes exactly one 3840 px q85 mozjpeg either way
 * (`DISPLAY_MAX_EDGE` in `derive.ts`); what it changes is peak work during
 * ingest, which is why the draft route carries an explicit `maxDuration` in
 * `vercel.json` and why `derive.ts` states `limitInputPixels`.
 *
 * There is no memory setting to go with it: this project is on the Hobby
 * plan, which offers no per-function memory override, so the function gets
 * the platform default and the only lever left is refusing absurd input
 * early. An earlier version of this paragraph claimed a memory budget that
 * `vercel.json` does not contain.
 */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/**
 * The same number as people write it, for prose and error messages.
 *
 * Derived rather than typed, so a sentence cannot disagree with the limit it
 * describes — which is precisely what happened to the sign-in link's expiry.
 */
export const MAX_UPLOAD_MB = MAX_UPLOAD_BYTES / (1024 * 1024);
