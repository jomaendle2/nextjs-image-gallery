"use client";

import { MapPin, Sparkles, Undo2 } from "lucide-react";
import {
  type ChangeEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { FIELD } from "@/components/ui/field";
import { GlassButton } from "@/components/ui/glass-button";
import { Notice } from "@/components/ui/Notice";
import type { Pin } from "@/lib/photos/types";
import { stageLabel } from "./fill";
import { HintMap } from "./HintMap";
import type { Suggesting } from "./useSuggestion";

/**
 * The button half of "Suggest details": say where it might be if you like,
 * ask the model, watch it write, and offer the one gesture that puts
 * everything back.
 *
 * The route this calls writes nothing and this component writes nothing
 * either. It puts proposed text into two inputs the photographer is already
 * looking at and a list of places under a third, and the existing
 * `savePhoto` action is still the only thing on this page that touches the
 * database — under the same caps and the same refusals it always applied.
 * Between the model and the row there is a person who has to press Save.
 *
 * **Overwrite the two sentences, then offer Undo.** The gentler rule reads
 * well and fails in use: press the button on a row that already has a title
 * and nothing visible happens, which is indistinguishable from the feature
 * being broken. And it is wrong about who is in charge — somebody who
 * presses a button called "Suggest details" on a captioned photograph is
 * asking for another opinion, not being ambushed. Nothing can be lost that a
 * single click does not return.
 *
 * **The place is the exception, and it is the point of the hint below.** A
 * model names a coastline with complete composure and is wrong about which
 * country's it is, so places arrive as chips nobody has to click. What turns
 * that from a shrug into an answer is being able to say "Algarve coast", or
 * to point at the coast — which is why this box exists at all.
 */

/**
 * The hint is never saved, and it is never saved *by construction*.
 *
 * No `name` attribute, so it is not in the `FormData` the surrounding form
 * submits and `savePhoto` cannot see it however it changes. That is a
 * stronger guarantee than remembering to clear it, and it is the reason this
 * is a separate box rather than a second use of the Location field: a hint
 * somebody does not want published must not have to be typed into the field
 * that gets published.
 */
export function SuggestDetails({
  photoId,
  mapStyleUrl,
  suggesting,
}: {
  photoId: string;
  /** Null when no `MAPTILER_KEY` is set: the typed hint still works. */
  mapStyleUrl: string | null;
  /** The run, owned by the form so the chips and the picker can see it too. */
  suggesting: Suggesting;
}) {
  const { stage, note, error, canUndo, answered, ask, undo } = suggesting;
  const busy = stage !== null;

  const [said, setSaid] = useState("");
  const [near, setNear] = useState<Pin | null>(null);
  const [mapOpen, setMapOpen] = useState(false);

  const handleNote = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setSaid(event.target.value),
    [],
  );
  const openMap = useCallback(() => setMapOpen(true), []);

  /*
   * The hint is cleared once it has been answered, and only then.
   *
   * A hint is about one attempt. Left in the box it would silently steer the
   * next photograph's suggestion — the form is reused row by row — and a
   * steer nobody remembers giving is the worst kind. A *failed* run clears
   * nothing, because retyping what you just typed in order to try again is
   * a punishment for our outage.
   */
  useEffect(() => {
    if (answered) {
      setSaid("");
      setNear(null);
    }
  }, [answered]);

  /*
   * Enter in this box asks for a suggestion rather than submitting the form.
   *
   * A lone text input inside a form makes Enter submit it — which here means
   * saving the photograph, from the one control on the page whose entire
   * promise is that it saves nothing. The key is intercepted rather than the
   * form being restructured, because the box genuinely belongs inside the
   * form it sits in.
   */
  const handleKey = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (!busy) {
          ask({ note: said === "" ? null : said, near });
        }
      }
    },
    [busy, ask, said, near],
  );

  const handleAsk = useCallback(() => {
    ask({ note: said === "" ? null : said, near });
  }, [ask, said, near]);

  const hintId = `hint-${photoId}`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {/*
          `type="button"` is load-bearing. This sits inside the edit form, and
          a button in a form submits it by default — pressing "Suggest
          details" would save the photograph, which is the one thing this
          whole feature promises not to do.
        */}
        <GlassButton
          disabled={busy}
          onClick={handleAsk}
          size="sm"
          type="button"
        >
          <Sparkles
            aria-hidden="true"
            className={`mr-1.5 ${busy ? "animate-pulse" : ""}`}
            size={14}
          />
          {busy ? "Suggesting…" : "Suggest details"}
        </GlassButton>

        {canUndo && !busy ? (
          <GlassButton onClick={undo} size="sm" type="button">
            <Undo2 aria-hidden="true" className="mr-1.5" size={14} />
            Undo
          </GlassButton>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={hintId}>
          Where it might be, if you want to say
        </label>
        <input
          className={`${FIELD} min-w-0 flex-1`}
          disabled={busy}
          id={hintId}
          onChange={handleNote}
          onKeyDown={handleKey}
          placeholder="Where it might be — “Algarve coast” (not saved)"
          value={said}
        />
        {mapStyleUrl === null || mapOpen ? null : (
          <GlassButton onClick={openMap} size="sm" type="button">
            <MapPin aria-hidden="true" className="mr-1.5" size={14} />
            Point at it
          </GlassButton>
        )}
      </div>

      {mapStyleUrl !== null && mapOpen ? (
        <HintMap near={near} onPick={setNear} styleUrl={mapStyleUrl} />
      ) : null}

      {/*
        One live region for both sentences, so a screen reader hears the
        progress and then the outcome as one thing changing rather than two
        appearing. Polite rather than assertive: neither of these needs to
        interrupt somebody mid-word, and the fields are filling in front of
        them regardless.
      */}
      <p
        aria-live="polite"
        className="min-h-4 text-[0.75rem] text-white/55 leading-relaxed"
      >
        {stage === null ? note : stageLabel(stage)}
      </p>

      {error === null ? null : <Notice tone="error">{error}</Notice>}
    </div>
  );
}
