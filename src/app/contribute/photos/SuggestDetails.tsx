"use client";

import { Sparkles, Undo2 } from "lucide-react";
import { useCallback, useState } from "react";
import { GlassButton } from "@/components/ui/glass-button";
import { Notice } from "@/components/ui/Notice";
import type { PhotoSuggestion } from "@/lib/ai/suggestion";
import { type FillableField, fillsFrom, suggestionNote } from "./fill";

/**
 * The button half of "Suggest details": ask the model, fill the boxes, and
 * offer the one gesture that puts them back.
 *
 * The route this calls writes nothing and this component writes nothing
 * either. It puts proposed text into three inputs the photographer is already
 * looking at, and the existing `savePhoto` action is still the only thing on
 * this page that touches the database — under the same caps and the same
 * refusals it always applied. Between the model and the row there is a person
 * who has to press Save.
 *
 * **Overwrite, then offer Undo, rather than fill only what is empty.** The
 * gentler rule reads well and fails in use: press the button on a row that
 * already has a title and nothing visible happens, which is indistinguishable
 * from the feature being broken. And it is wrong about who is in charge —
 * somebody who presses a button called "Suggest details" on a captioned
 * photograph is asking for another opinion, not being ambushed. So every
 * field the model answered is written, the previous text is kept in memory,
 * and Undo puts all of it back at once. Nothing can be lost that a single
 * click does not return.
 *
 * The exception is a field the model did not answer, which is skipped rather
 * than blanked; `fill.ts` owns that rule and is tested on it.
 */

/**
 * The inputs, found by id.
 *
 * The same mechanism `PhotoEditForm` already uses to move the cursor to a
 * refused field, and for the same reason: the boxes are uncontrolled
 * (`defaultValue`) so that `PhotoCard` can stay memoized and a keystroke in
 * the search box does not re-render fifty rows. There is no React state
 * holding these values to update — the DOM node is where the text lives, so
 * the DOM node is what gets written.
 *
 * The `instanceof` pair is not ceremony. `getElementById` will happily return
 * whatever else has claimed that id, and writing `.value` onto an element
 * that has no such property fails silently and forever.
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

/**
 * When the request itself fails rather than the server refusing it.
 *
 * Every refusal the route sends back is a sentence written for a person — not
 * signed in, not switched on, too many requests, or the one apology it makes
 * for its own faults — so those are shown as they arrive. This covers the
 * case where no sentence arrived at all: the network dropped, or the response
 * was not the JSON we expect.
 */
const UNREACHABLE =
  "The suggestion could not be made just now. Try again in a moment, or " +
  "write it yourself — nothing has been changed either way.";

/** The text that was in the boxes before the model's answer went in. */
type Restore = [FillableField, string][];

/**
 * The body, or nothing, without letting a parse failure become the error.
 *
 * A 502 from the route carries a sentence; a 502 from something in front of
 * it carries an HTML page, and `response.json()` throws on that. Both are the
 * same event to the person waiting, so the parse failure is turned into
 * "there was no sentence" and the caller decides what to say.
 */
async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
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

export function SuggestDetails({
  photoId,
  onFilled,
}: {
  photoId: string;
  /**
   * That the form has changed under the photographer.
   *
   * The form retires its last "Published." on any `change` event, and setting
   * `.value` from script fires none — so a stale success message would sit
   * under three fields it no longer describes. This is that event, sent by
   * hand.
   */
  onFilled: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [restore, setRestore] = useState<Restore | null>(null);

  const apply = useCallback(
    (suggestion: PhotoSuggestion) => {
      const previous: Restore = [];

      for (const [field, value] of fillsFrom(suggestion)) {
        const element = fieldElement(field, photoId);
        if (element !== null) {
          previous.push([field, element.value]);
          element.value = value;
        }
      }

      /*
       * No Undo offered when nothing moved. A button that restores three
       * fields to exactly what they already say is a button that does
       * nothing, and it would appear precisely when the feature had least
       * to show for itself.
       */
      setRestore(previous.length === 0 ? null : previous);
      setNote(suggestionNote(suggestion));
      onFilled();
    },
    [photoId, onFilled],
  );

  const ask = useCallback(() => {
    setError(null);
    setPending(true);

    /*
     * `fetch` rather than a server action, and that is the shape of the
     * thing rather than a preference: this call returns data to a form
     * without revalidating anything, because nothing on the server changed.
     * A server action would push a router refresh through the page and
     * re-render every other open row on it.
     */
    const asking = async () => {
      const response = await fetch(`/api/photos/${photoId}/suggest`, {
        method: "POST",
      });
      const body = await readBody(response);

      if (!response.ok) {
        throw new Error(refusalFrom(body));
      }

      apply(body as PhotoSuggestion);
    };

    asking()
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : UNREACHABLE);
      })
      .finally(() => {
        setPending(false);
      });
  }, [photoId, apply]);

  const undo = useCallback(() => {
    for (const [field, value] of restore ?? []) {
      const element = fieldElement(field, photoId);
      if (element !== null) {
        element.value = value;
      }
    }
    setRestore(null);
    setNote(null);
    onFilled();
  }, [restore, photoId, onFilled]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {/*
          `type="button"` is load-bearing. This sits inside the edit form, and
          a button in a form submits it by default — pressing "Suggest
          details" would save the photograph, which is the one thing this
          whole feature promises not to do.
        */}
        <GlassButton disabled={pending} onClick={ask} size="sm" type="button">
          <Sparkles aria-hidden="true" className="mr-1.5" size={14} />
          {pending ? "Looking…" : "Suggest details"}
        </GlassButton>

        {restore === null ? null : (
          <GlassButton onClick={undo} size="sm" type="button">
            <Undo2 aria-hidden="true" className="mr-1.5" size={14} />
            Undo
          </GlassButton>
        )}
      </div>

      {/*
        Polite rather than an alert, and announced because the change it
        describes happens somewhere else on screen. Three fields quietly
        filling themselves is invisible to anybody who is not looking at
        them.
      */}
      {note === null ? null : (
        <p
          aria-live="polite"
          className="text-[0.75rem] text-white/55 leading-relaxed"
        >
          {note}
        </p>
      )}

      {error === null ? null : <Notice tone="error">{error}</Notice>}
    </div>
  );
}
