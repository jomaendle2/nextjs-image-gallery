"use client";

import { useCallback, useRef, useState } from "react";
import type { SuggestionRecord } from "@/lib/ai/stream";
import type { PhotoSuggestion } from "@/lib/ai/suggestion";
import {
  type FillableField,
  fillsFrom,
  type SuggestionStage,
  stageOf,
  suggestionNote,
} from "./fill";
import { readNdjson } from "./ndjson";

/**
 * Asking a model for three fields, and putting its answer into the form as it
 * is written.
 *
 * All of the mechanism, so that `SuggestDetails` is markup. What lives here
 * is the part with a shape worth reading on its own: a stream arriving into
 * boxes somebody may already have typed in, and the bookkeeping that lets all
 * of it be taken back.
 *
 * The fields are written through the DOM rather than through state, because
 * they are uncontrolled — `defaultValue`, which is what keeps `PhotoCard`
 * memoized so a keystroke in the search box does not re-render fifty rows.
 * There is no React value to set; the input is where the text lives.
 */

/**
 * When the request itself fails rather than the server refusing it.
 *
 * Every refusal the route sends is a sentence written for a person — not
 * signed in, not switched on, too many requests, or the apology it makes for
 * its own faults — so those are shown as they arrive. This covers the case
 * where no sentence arrived at all: the network dropped, or the response was
 * not what we parse.
 */
const UNREACHABLE =
  "The suggestion could not be made just now. Try again in a moment, or " +
  "write it yourself — nothing has been changed either way.";

/**
 * The inputs, found by id — the same mechanism `PhotoEditForm` uses to move
 * the cursor to a refused field.
 *
 * The `instanceof` pair is not ceremony. `getElementById` will happily return
 * whatever else has claimed that id, and writing `.value` onto an element
 * with no such property fails silently and for ever.
 */
function fieldElement(
  field: FillableField,
  photoId: string,
): HTMLInputElement | HTMLTextAreaElement | null {
  const element = document.getElementById(`${field}-${photoId}`);
  return element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
    ? element
    : null;
}

/** The sentence the server sent, when it sent one written for a person. */
function refusalFrom(body: unknown): string {
  return typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string"
    ? body.error
    : UNREACHABLE;
}

/** A line off the wire, once we have decided it is one of ours. */
function asRecord(value: unknown): SuggestionRecord | null {
  return typeof value === "object" && value !== null && "type" in value
    ? (value as SuggestionRecord)
    : null;
}

export interface Suggesting {
  /** What the model is doing, or null when it is not doing anything. */
  stage: SuggestionStage | null;
  /** The sentence under the fields once an answer has landed. */
  note: string | null;
  /** What went wrong, in words meant for the person who pressed the button. */
  error: string | null;
  /** Whether there is anything to put back. */
  canUndo: boolean;
  ask: () => void;
  undo: () => void;
}

export function useSuggestion(
  photoId: string,
  /**
   * That the form has changed under the photographer.
   *
   * The form retires its last "Published." on any `change` event, and setting
   * `.value` from script fires none — so a stale success message would sit
   * under three fields it no longer describes. This is that event, by hand.
   */
  onFilled: () => void,
): Suggesting {
  const [stage, setStage] = useState<SuggestionStage | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  /**
   * What each field said before this run first wrote to it.
   *
   * A ref rather than state: it is written on every chunk and read only when
   * something is put back, so making it state would re-render the row for
   * each token of a title nobody is looking at through React.
   *
   * Recorded on first write per field, which is the only moment the original
   * still exists. It is also what makes Undo whole — the map ends up holding
   * exactly the fields this run touched, and nothing else.
   */
  const before = useRef(new Map<FillableField, string>());

  const write = useCallback(
    (suggestion: Partial<PhotoSuggestion>) => {
      for (const [field, value] of fillsFrom(suggestion)) {
        const element = fieldElement(field, photoId);
        if (element !== null) {
          if (!before.current.has(field)) {
            before.current.set(field, element.value);
          }
          element.value = value;
        }
      }
    },
    [photoId],
  );

  /** Put back the fields named, and forget that they were ever written. */
  const putBack = useCallback(
    (fields: Iterable<FillableField>) => {
      for (const field of fields) {
        const element = fieldElement(field, photoId);
        const original = before.current.get(field);
        if (element !== null && original !== undefined) {
          element.value = original;
        }
        before.current.delete(field);
      }
    },
    [photoId],
  );

  /**
   * The validated answer replaces whatever the stream had been showing.
   *
   * And a field this run wrote that the final answer does not name is put
   * back rather than left holding a prefix. That is not a hypothetical: the
   * model can talk itself out of a place it had begun to name, and the box
   * would otherwise keep the half of the guess it had already typed.
   */
  const settle = useCallback(
    (final: PhotoSuggestion) => {
      write(final);

      const kept = new Set(fillsFrom(final).map(([field]) => field));
      putBack([...before.current.keys()].filter((field) => !kept.has(field)));

      setCanUndo(before.current.size > 0);
      setNote(suggestionNote(final));
    },
    [write, putBack],
  );

  /**
   * The stream, record by record, until it ends or says it cannot go on.
   *
   * An `error` record is re-thrown rather than handled here so that there is
   * one place that decides what a failed run does to the form — the `catch`
   * below, which puts every field back. A stream that dies halfway and a
   * request that never connected leave the page in the same state, which is
   * the state the error message promises.
   */
  const consume = useCallback(
    async (body: ReadableStream<Uint8Array>) => {
      for await (const line of readNdjson(body)) {
        const record = asRecord(line);

        if (record?.type === "partial") {
          setStage(stageOf(record.value));
          write(record.value);
        } else if (record?.type === "done") {
          settle(record.value);
        } else if (record?.type === "error") {
          throw new Error(record.message);
        }
      }
    },
    [write, settle],
  );

  const ask = useCallback(() => {
    setError(null);
    setNote(null);
    setStage("looking");
    before.current = new Map();

    const asking = async () => {
      const response = await fetch(`/api/photos/${photoId}/suggest`, {
        method: "POST",
      });

      /*
       * A refusal is still an ordinary JSON body with a status on it. Only
       * what happens after the model has started streaming has to be carried
       * inside a 200, which is why both shapes exist.
       */
      if (!response.ok || response.body === null) {
        throw new Error(refusalFrom(await response.json().catch(() => null)));
      }

      onFilled();
      await consume(response.body);
    };

    asking()
      .catch((cause: unknown) => {
        /*
         * The form goes back to what it said before the button was pressed.
         * The message promises that nothing has been changed either way, and
         * a half-written title left in the box would make that untrue.
         */
        putBack([...before.current.keys()]);
        setCanUndo(false);
        setNote(null);
        setError(cause instanceof Error ? cause.message : UNREACHABLE);
      })
      .finally(() => {
        setStage(null);
        onFilled();
      });
  }, [photoId, onFilled, consume, putBack]);

  const undo = useCallback(() => {
    putBack([...before.current.keys()]);
    setCanUndo(false);
    setNote(null);
    onFilled();
  }, [putBack, onFilled]);

  return { stage, note, error, canUndo, ask, undo };
}
