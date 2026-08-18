import type { PhotoSuggestion } from "./suggestion";

/**
 * What travels between the route and the form while a model is writing.
 *
 * Newline-delimited JSON rather than server-sent events, and the choice is
 * about what is being sent rather than fashion. SSE brings named events,
 * reconnection and an id protocol; this is one short-lived POST that a
 * photographer either watches or abandons, and reconnecting to a half-written
 * caption would be worse than starting again. NDJSON is `JSON.parse` per
 * line, which is the whole client.
 *
 * The types are declared once and imported by both ends, so the route cannot
 * emit a shape the form does not read.
 */

export type SuggestionRecord =
  /**
   * The fields as they are being written. Every one is a prefix that may
   * still change, and the form shows them without committing to them.
   */
  | { type: "partial"; value: Partial<PhotoSuggestion> }
  /**
   * The validated answer, and the only record whose absence means something
   * went wrong. The form treats this as authoritative: a field the stream had
   * been filling that this record does not name is put back the way it was,
   * so a sentence the model began and then abandoned does not leave a prefix
   * in a box. The places are simply replaced — nothing to put back, because
   * nothing was written.
   */
  | {
      type: "done";
      value: PhotoSuggestion;
      /**
       * That this answer was rescued from a run that did not finish.
       *
       * A salvaged answer carries no places — `salvage` drops them, because a
       * half-streamed place name is a prefix and a prefix is offered as a
       * button that writes a location. Without this flag the form could not
       * tell that apart from a model that genuinely found nothing, and said
       * so out loud: "Nothing in the frame pointed anywhere" is a claim about
       * the photograph, and it would have been false every time a provider
       * truncated a stream.
       */
      salvaged?: boolean;
    }
  /**
   * A sentence for the person waiting, sent inside a 200 because the response
   * had already begun by the time anything went wrong. A status code cannot
   * be revised once the headers are out; this is the only way to say so.
   */
  | { type: "error"; message: string };

/** One record, as a line. The newline is the delimiter, so it is included. */
export function encodeRecord(record: SuggestionRecord): string {
  return `${JSON.stringify(record)}\n`;
}

/**
 * The media type both ends agree on.
 *
 * Not `application/json`: this body is a sequence of documents rather than
 * one, and anything that buffers it to parse it — a proxy, a devtools pane,
 * a future `response.json()` — would be wrong about it in a way that only
 * shows up as the stream not arriving until it has finished.
 */
export const NDJSON = "application/x-ndjson";

/**
 * The one apology for a failure that is ours, wherever it is noticed.
 *
 * The route said this when a model call died and `suggestRequest` said it
 * when the request never got a body — two byte-identical copies, in two
 * files, with nothing linking them. Editing one produced two different
 * apologies for the same failure depending on which side of the first byte it
 * happened on. It lives here because this module is what both ends already
 * import to agree on the wire format, and this sentence is part of it.
 */
export const OUR_FAULT_MESSAGE =
  "The suggestion could not be made just now. Try again in a moment, or " +
  "write it yourself — nothing has been changed either way.";
