import { OUR_FAULT_MESSAGE } from "@/lib/ai/stream";

/** The sentence the server sent, when it sent one written for a person. */
function refusalFrom(body: unknown): string {
  return typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string"
    ? body.error
    : OUR_FAULT_MESSAGE;
}

/**
 * Ask for a suggestion, and hand back the stream to read.
 *
 * Its own module because `useSuggestion` had grown past the file's line
 * budget and `ask` past its complexity one — but the split follows a real
 * seam rather than the lint rule. Everything here is about the request: how
 * it is addressed, and how a refusal is turned into a sentence. Everything
 * left in the hook is about the form: what gets written, what gets put back,
 * and which run is still allowed to touch it.
 *
 * A refusal is an ordinary JSON body with a status on it, and is thrown as an
 * `Error` carrying the server's own words. Only what happens *after* the
 * model has started streaming has to be carried inside a 200, which is why
 * both shapes exist and why the caller still has to watch the stream for an
 * `error` record.
 */
export async function openSuggestion(
  photoId: string,
  signal: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(`/api/photos/${photoId}/suggest`, {
    method: "POST",
    /*
     * No body: the photograph and its stored EXIF are the whole prompt, both
     * resolved server-side from the id in the path. The request used to carry
     * a hint, and the route stopped reading bodies when that feature went.
     *
     * The signal reaches the request as well as the caller's read loop, so an
     * abandoned run also closes the connection — the route holds a model call
     * open for as long as somebody is listening, and that call is billed
     * whether or not anyone still wants the answer.
     */
    signal,
  });

  if (!response.ok || response.body === null) {
    throw new Error(refusalFrom(await response.json().catch(() => null)));
  }

  return response.body;
}
