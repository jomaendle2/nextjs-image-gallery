"use client";

import { Sparkles, Undo2 } from "lucide-react";
import { GlassButton } from "@/components/ui/glass-button";
import { Notice } from "@/components/ui/Notice";
import { stageLabel } from "./fill";
import type { Suggesting } from "./useSuggestion";
import { Why } from "./Why";

/**
 * One button: ask the model, watch it write, and offer the one gesture that
 * puts everything back.
 *
 * It used to be five things — this button, a hint input ("Where it might be —
 * … (not saved)"), a "Point at it" map, the consent line and the status line —
 * and the first real test user could not tell the hint input from the
 * Location field below it. The hint was an optional steer that cost a second
 * location-ish input and a second map on a form that already had one of each,
 * so it is gone end to end: the photograph and its stored camera settings are
 * the whole prompt. A wrong guess is corrected by typing into the one real
 * field — which is what the photographer would have done anyway.
 *
 * The route this calls writes nothing and this component writes nothing
 * either. It puts proposed text into the inputs the photographer is already
 * looking at, and the existing `savePhoto` action is still the only thing on
 * this page that touches the database — under the same caps and the same
 * refusals it always applied. Between the model and the row there is a
 * person who has to press Save.
 *
 * **Overwrite the sentences, then offer Undo.** The gentler rule reads well
 * and fails in use: press the button on a row that already has a title and
 * nothing visible happens, which is indistinguishable from the feature being
 * broken. And it is wrong about who is in charge — somebody who presses a
 * button called "Suggest details" on a captioned photograph is asking for
 * another opinion, not being ambushed. Nothing can be lost that a single
 * click does not return.
 */
export function SuggestDetails({
  suggesting,
}: {
  /** The run, owned by the form so the chips and the picker can see it too. */
  suggesting: Suggesting;
}) {
  const { stage, note, error, canUndo, ask, undo } = suggesting;
  const busy = stage !== null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {/*
          `type="button"` is load-bearing. This sits inside the edit form, and
          a button in a form submits it by default — pressing "Suggest
          details" would save the photograph, which is the one thing this
          feature promises not to do.
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
        The consent for the one thing on this form that leaves the building,
        at the moment the decision is made — `Why`'s own docblock says that is
        the only place such a statement is worth anything.
      */}
      <Why summary="Pressing this sends the photograph to a model to look at.">
        What goes out is the copy the gallery already publishes — the re-encode
        that carries no metadata of any kind — never the file off your camera,
        which is the only one that still holds whatever GPS it wrote. It goes
        through Vercel's AI Gateway to Google or Anthropic, both on terms that
        forbid training on it, and neither they nor this site keeps it. Nothing
        it suggests touches your photograph until you have read it and pressed
        Save.
      </Why>

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
