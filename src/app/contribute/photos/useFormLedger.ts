"use client";

import { useCallback, useRef, useState } from "react";
import type { PhotoSuggestion } from "@/lib/ai/suggestion";
import { fieldElement, fillsFrom, type TouchedField } from "./fill";

/**
 * Everything the suggestion feature has written into the form, and how to
 * put it back.
 *
 * Split out of `useSuggestion` when that file reached the length limit, but
 * the seam is not arbitrary — this is the half that is answerable for the
 * photographer's own text. The other half talks to a model and decides what
 * a suggestion means; this one owns the single promise the feature makes to
 * the person using it, which is that nothing it does is permanent until they
 * save, and that one button takes all of it back.
 *
 * Keeping the two apart is worth a file because the failure modes are
 * different in kind. A bug in the run loses a suggestion, which costs a
 * button press. A bug in here loses a caption somebody wrote, which cannot
 * be recovered at all — and every past bug of that shape (a second run
 * making the first run's originals unreachable; a controlled field restored
 * through the DOM and immediately overwritten) lived in these forty lines.
 */

/**
 * A value for the picker's controlled field, stamped so that the same one
 * can be sent twice.
 *
 * The stamp is a counter rather than a clock. Two chips accepted inside the
 * same millisecond would collide on `Date.now()`, and a counter cannot.
 */
let proposals = 0;
function stamp(text: string): { text: string; at: number } {
  proposals += 1;
  return { text, at: proposals };
}

export interface FormLedger {
  /** Whether there is anything to put back. */
  canUndo: boolean;
  /** The picker's controlled value, when something has been offered to it. */
  proposed: { text: string; at: number } | null;
  /**
   * Record that *this* run wrote a field by itself.
   *
   * Tracked separately from the originals because the two questions differ.
   * A failed run undoes what that run did; Undo undoes everything the
   * feature has done since it was last pressed. A place somebody accepted
   * from a chip two runs ago belongs to the second answer and not the first.
   *
   * Methods rather than the ref itself, though the ref is what it is. The
   * set is added to on every chunk of a stream, so it cannot be state — but
   * handing the ref out made `touched.current` a dependency of every caller
   * that reads it, which is a lie either way round: listed, it never
   * changes identity; unlisted, the linter is right that something was
   * closed over. Two stable functions have neither problem.
   */
  markTouched: (field: TouchedField) => void;
  /** Which fields this run wrote, as a list that will not change under you. */
  touchedFields: () => TouchedField[];
  /** Remember what a field held, the first time this feature changes it. */
  remember: (field: TouchedField, current: string) => void;
  /** Write a suggestion's text fields into the form, remembering as it goes. */
  write: (suggestion: Partial<PhotoSuggestion>) => void;
  /** Put back the fields named, and forget that they were ever written. */
  putBack: (fields: Iterable<TouchedField>) => void;
  /** Offer a value to the controlled coordinate field. */
  propose: (text: string) => void;
  /** Forget which fields this run wrote, without putting anything back. */
  clearTouched: () => void;
  /**
   * Put every field back to what it said before any of this started.
   *
   * The Undo button, as opposed to the failure path — which sweeps only the
   * run that failed. Here rather than at the call site because the map of
   * originals is this hook's private business: exposing it so somebody else
   * could enumerate the keys would make every future caller a place the
   * ledger can be got wrong from.
   */
  undoAll: () => void;
}

export function useFormLedger(photoId: string): FormLedger {
  const [canUndo, setCanUndo] = useState(false);
  const [proposed, setProposed] = useState<{ text: string; at: number } | null>(
    null,
  );

  /**
   * What each field said before this feature first changed it.
   *
   * A ref rather than state: it is written on every chunk and read only when
   * something is put back, so making it state would re-render the row for
   * each token of a title nobody is looking at through React.
   *
   * **Not cleared when the button is pressed again**, which it used to be —
   * and that was a way to lose text for good. A second run would replace the
   * map wholesale, so the values from before the *first* run became
   * unreachable and Undo put the form back to the first suggestion rather
   * than to what the photographer had written. Entries are recorded on first
   * write and removed only by being restored, so this map always holds the
   * form as it stood before any of this started.
   */
  const before = useRef(new Map<TouchedField, string>());
  const touched = useRef(new Set<TouchedField>());

  const remember = useCallback((field: TouchedField, current: string) => {
    if (!before.current.has(field)) {
      before.current.set(field, current);
    }
    setCanUndo(true);
  }, []);

  const propose = useCallback((text: string) => {
    setProposed(stamp(text));
  }, []);

  const write = useCallback(
    (suggestion: Partial<PhotoSuggestion>) => {
      for (const [field, value] of fillsFrom(suggestion)) {
        const element = fieldElement(field, photoId);
        if (element !== null) {
          remember(field, element.value);
          touched.current.add(field);
          element.value = value;
        }
      }
    },
    [photoId, remember],
  );

  const putBack = useCallback(
    (fields: Iterable<TouchedField>) => {
      for (const field of fields) {
        const original = before.current.get(field);
        if (original !== undefined) {
          /*
           * The pin goes back through the picker rather than through the
           * element, because that field is controlled: writing `.value` on
           * it would be overwritten by the next render, and the photographer
           * would watch their coordinate reappear.
           */
          if (field === "pin") {
            setProposed(stamp(original));
          } else {
            const element = fieldElement(field, photoId);
            if (element !== null) {
              element.value = original;
            }
          }
          before.current.delete(field);
          touched.current.delete(field);
        }
      }
      setCanUndo(before.current.size > 0);
    },
    [photoId],
  );

  const markTouched = useCallback((field: TouchedField) => {
    touched.current.add(field);
  }, []);

  const touchedFields = useCallback(() => [...touched.current], []);

  const clearTouched = useCallback(() => {
    touched.current = new Set();
  }, []);

  const undoAll = useCallback(() => {
    putBack([...before.current.keys()]);
  }, [putBack]);

  return {
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
  };
}
