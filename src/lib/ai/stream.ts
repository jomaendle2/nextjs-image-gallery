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
   * been filling that this record does not name is put back the way it was —
   * which is how a place the model talked itself out of leaves the box.
   */
  | { type: "done"; value: PhotoSuggestion }
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
