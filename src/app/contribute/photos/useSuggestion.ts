"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { OUR_FAULT_MESSAGE, type SuggestionRecord } from "@/lib/ai/stream";
import type { PhotoSuggestion, PlaceGuess } from "@/lib/ai/suggestion";
import type { PhotoTag } from "@/lib/photos/tags";
import {
  fieldElement,
  fillsFrom,
  locationToFill,
  pinToDrop,
  type SuggestionStage,
  stageOf,
  suggestionNote,
  type TouchedField,
} from "./fill";
import { pointText } from "./LocationPicker";
import { readNdjson } from "./ndjson";
import { openSuggestion } from "./suggestRequest";
import { useFormLedger } from "./useFormLedger";

/**
 * Asking a model to look at a photograph, and putting its answer into the
 * form — the two sentences as they are written, the places only if somebody
 * clicks one.
 *
 * All of the mechanism, so that `SuggestDetails` and `PlaceChoices` are
 * markup. What lives here is the part with a shape worth reading on its own:
 * a stream arriving into boxes somebody may already have typed in, and the
 * bookkeeping that lets all of it be taken back.
 *
 * The two text fields are written through the DOM rather than through state,
 * because they are uncontrolled — `defaultValue`, which is what keeps
 * `PhotoCard` memoized so a keystroke in the search box does not re-render
 * fifty rows. There is no React value to set; the input is where the text
 * lives. The coordinate field is the exception and is handled as one: it is
 * controlled inside `LocationPicker`, so it is changed by handing that
 * component a value rather than by writing to the element.
 */

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
  /** The places on offer, or none. Rendered as chips, never written. */
  places: PlaceGuess[];
  /**
   * The subjects on offer, or none. Chips too, and never written at all —
   * not even by the auto-fill that now takes a sure place. Filing a
   * photograph under a subject is a judgement its photographer can make by
   * looking at it, so it stays a click.
   */
  tags: PhotoTag[];
  /** Whether an answer has landed, so an empty list can be said out loud. */
  answered: boolean;
  ask: () => void;
  undo: () => void;
  /** Put a candidate's name in the Location field. */
  takeName: (place: PlaceGuess) => void;
  /** Put a candidate's coordinates in the picker, and open it. */
  takePoint: (place: PlaceGuess) => void;
  /** The picker's controlled value, when something has been offered to it. */
  proposed: { text: string; at: number } | null;
}

export function useSuggestion(
  photoId: string,
  /**
   * That the form has changed under the photographer.
   *
   * The form retires its last "Published." on any `change` event, and setting
   * `.value` from script fires none — so a stale success message would sit
   * under the fields it no longer describes. This is that event, by hand.
   */
  onFilled: () => void,
): Suggesting {
  const [stage, setStage] = useState<SuggestionStage | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [places, setPlaces] = useState<PlaceGuess[]>([]);
  const [tags, setTags] = useState<PhotoTag[]>([]);
  const [answered, setAnswered] = useState(false);

  /**
   * The run in flight, so it can be called off.
   *
   * There is at most one: `ask` aborts whatever it finds here before it
   * starts, and the cleanup below aborts on the way out. Without it a run
   * outlived the row that started it — `PhotoList` renders only the photos
   * matching the current search and filter, so a single keystroke in the
   * search box unmounts an open form mid-stream.
   */
  const running = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      running.current?.abort();
    },
    [],
  );

  /*
   * The undo ledger, which is the half of this feature answerable for the
   * photographer's own words. `useFormLedger` explains why it is a separate
   * file and not merely a shorter one.
   */
  const {
    canUndo,
    proposed,
    markTouched,
    touchedFields,
    remember,
    write,
    putBack,
    propose,
    clearTouched,
    undoAll,
  } = useFormLedger(photoId);

  /**
   * The validated answer replaces whatever the stream had been showing.
   *
   * And a field *this run* wrote that the final answer does not name is put
   * back rather than left holding a prefix. Only this run's automatic
   * writes are swept: a place the photographer accepted from a chip is
   * theirs, and a sweep that reached it would take a decision back out of
   * the form because a later token arrived.
   */
  const settle = useCallback(
    (final: PhotoSuggestion, salvaged = false) => {
      write(final);
      setPlaces(final.places);
      setTags(final.tags);
      /*
       * `answered` is what lets the empty list say "nothing in the frame
       * pointed anywhere" out loud, so a salvaged run must not set it: that
       * run's places were discarded by `salvage`, not absent from the
       * photograph, and the sentence would be a false claim about somebody's
       * own picture. Nothing is said instead, which is the honest amount.
       */
      setAnswered(!salvaged);

      const kept = new Set<TouchedField>(
        fillsFrom(final).map(([field]) => field),
      );
      putBack(touchedFields().filter((field) => !kept.has(field)));

      // A sure place fills an empty Location field; `locationToFill` holds
      // the decision, this is only the write. Undo covers it like the rest.
      const location = fieldElement("location", photoId);
      const name =
        location === null ? null : locationToFill(final.places, location.value);
      if (location !== null && name !== null) {
        remember("location", location.value);
        /*
         * Recorded as this run's, so the failure path sweeps it. A stream
         * dying after this write would otherwise restore title and
         * description — under a message promising nothing changed — and
         * leave the guess in the Location field with its chips cleared.
         * `touched` was `Set<FillableField>`, which could not hold
         * "location" at all; `TouchedField` is what lets it be swept.
         */
        markTouched("location");
        location.value = name;
      }

      /*
       * And the pin, on the same guess and under the same rule — the same
       * decision, in fact, which is `name` above rather than a second look at
       * the field. The field has been written into by the time this runs, so
       * asking it again would answer "occupied" and refuse the pin in exactly
       * the case the pin exists for.
       *
       * A photographer who has just watched "Taipei, Taiwan" fill itself in
       * should not then have to press "Put a pin roughly here" to say the
       * same thing again. The point goes through the picker rather than the
       * DOM because that field is controlled — writing `.value` on it would
       * be overwritten by the next render.
       */
      const pin = fieldElement("pin", photoId);
      const point = pinToDrop(final.places, pin?.value ?? "", name !== null);
      if (point !== null) {
        remember("pin", pin?.value ?? "");
        markTouched("pin");
        propose(pointText(point));
      }

      setNote(suggestionNote());
    },
    [write, putBack, photoId, remember, markTouched, touchedFields, propose],
  );

  /**
   * The stream, record by record, until it ends or says it cannot go on.
   *
   * An `error` record is re-thrown rather than handled here so that there is
   * one place that decides what a failed run does to the form — the `catch`
   * below, which puts every field this run wrote back. A stream that dies
   * halfway and a request that never connected leave the page in the same
   * state, which is the state the error message promises.
   */
  /** What one record off the wire does to the form. */
  const apply = useCallback(
    (record: SuggestionRecord | null) => {
      if (record?.type === "partial") {
        setStage(stageOf(record.value));
        write(record.value);
        if (record.value.places !== undefined) {
          setPlaces(record.value.places);
        }
        if (record.value.tags !== undefined) {
          setTags(record.value.tags);
        }
      } else if (record?.type === "done") {
        settle(record.value, record.salvaged === true);
      } else if (record?.type === "error") {
        throw new Error(record.message);
      }
    },
    [write, settle],
  );

  const consume = useCallback(
    async (body: ReadableStream<Uint8Array>, signal: AbortSignal) => {
      for await (const line of readNdjson(body)) {
        /*
         * The abandoned run stops writing here.
         *
         * `write` reaches the inputs through `document.getElementById`, so a
         * run whose row has been unmounted does not fail — it finds whatever
         * element now carries that id. Filtering the dashboard and reopening
         * the same row mounts a *fresh* form, and the old run would type into
         * it: no "Suggesting…" label, no Undo button, and the photographer's
         * own text overwritten with no way back, because all of that state
         * belonged to the dead hook. The signal is what separates the run
         * that owns these fields from one that has been replaced.
         */
        if (signal.aborted) {
          return;
        }

        apply(asRecord(line));
      }
    },
    [apply],
  );

  const ask = useCallback(() => {
    /*
     * Whatever was running stops now.
     *
     * Pressing the button twice used to leave two live streams writing to
     * the same three inputs, and the loser could land last.
     */
    running.current?.abort();
    const controller = new AbortController();
    running.current = controller;
    const { signal } = controller;

    setError(null);
    setNote(null);
    setStage("looking");
    setPlaces([]);
    setTags([]);
    setAnswered(false);
    clearTouched();

    const asking = async () => {
      const body = await openSuggestion(photoId, signal);
      onFilled();
      await consume(body, signal);
    };

    asking()
      .catch((cause: unknown) => {
        /*
         * An abandoned run says nothing and puts nothing back.
         *
         * It has already been replaced by a newer run or its row is gone,
         * so both halves of the ordinary failure path would be wrong here:
         * `putBack` would restore this run's remembered values over fields
         * the *newer* run is currently writing, and the error notice would
         * accuse the feature of failing when the photographer simply
         * pressed the button again.
         */
        if (signal.aborted) {
          return;
        }

        /*
         * The form goes back to what it said before the button was
         * pressed. The message promises that nothing has been changed
         * either way, and a half-written title left in the box would make
         * that untrue.
         */
        putBack(touchedFields());
        setPlaces([]);
        /*
         * The subject chips go with the place chips, and for the same
         * reason: the notice below promises nothing was changed, and a row
         * of clickable subjects left over from a run that failed is a
         * suggestion nobody's photograph produced.
         */
        setTags([]);
        setAnswered(false);
        setNote(null);
        setError(cause instanceof Error ? cause.message : OUR_FAULT_MESSAGE);
      })
      .finally(() => {
        if (signal.aborted) {
          return;
        }
        setStage(null);
        onFilled();
      });
  }, [photoId, onFilled, consume, putBack, touchedFields, clearTouched]);

  const undo = useCallback(() => {
    undoAll();
    setNote(null);
    onFilled();
  }, [undoAll, onFilled]);

  /**
   * A chip click is an edit like any other.
   *
   * Which is the whole reason it can be offered at all: the model's guess
   * reaches the Location field the same way a typed word does, and leaves
   * the same way. Recorded before the write, so Undo has somewhere to put
   * the previous place back.
   */
  const takeName = useCallback(
    (place: PlaceGuess) => {
      const element = fieldElement("location", photoId);
      if (element === null) {
        return;
      }
      remember("location", element.value);
      element.value = place.name;
      onFilled();
    },
    [photoId, remember, onFilled],
  );

  const takePoint = useCallback(
    (place: PlaceGuess) => {
      if (place.point === null) {
        return;
      }
      remember("pin", fieldElement("pin", photoId)?.value ?? "");
      propose(pointText(place.point));
      onFilled();
    },
    [photoId, remember, onFilled, propose],
  );

  return {
    stage,
    note,
    error,
    canUndo,
    places,
    tags,
    answered,
    ask,
    undo,
    takeName,
    takePoint,
    proposed,
  };
}
