"use client";

import { Sparkles, Undo2 } from "lucide-react";
import { GlassButton } from "@/components/ui/glass-button";
import { Notice } from "@/components/ui/Notice";
import { stageLabel } from "./fill";
import { useSuggestion } from "./useSuggestion";

/**
 * The button half of "Suggest details": ask the model, watch it write, and
 * offer the one gesture that puts everything back.
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
 * field the model answers is written, the previous text is kept, and Undo
 * puts all of it back at once. Nothing can be lost that a single click does
 * not return.
 *
 * **The fields fill as the model writes them.** A vision model takes several
 * seconds over a photograph, and a button that says "Looking…" for six of
 * them is indistinguishable from a button that has failed — so the answer
 * arrives a word at a time into the boxes it belongs in. The line beneath
 * says which field is being written, but the fields themselves are the real
 * feedback; the sentence is only its caption.
 */

export function SuggestDetails({
  photoId,
  onFilled,
}: {
  photoId: string;
  onFilled: () => void;
}) {
  const { stage, note, error, canUndo, ask, undo } = useSuggestion(
    photoId,
    onFilled,
  );
  const busy = stage !== null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {/*
          `type="button"` is load-bearing. This sits inside the edit form, and
          a button in a form submits it by default — pressing "Suggest
          details" would save the photograph, which is the one thing this
          whole feature promises not to do.
        */}
        <GlassButton disabled={busy} onClick={ask} size="sm" type="button">
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
