"use client";

import type { ReactNode } from "react";
import { FIELD, LABEL, LABEL_HINT, META } from "@/components/ui/field";
import { MAX_DESCRIPTION, MAX_TITLE } from "@/lib/photos/caps";
import type { OwnPhotoRow } from "@/lib/photos/types";
import { type Marks, marksFor } from "./marks";

/**
 * Everything anybody who visits the site can read.
 *
 * Grouped and labelled, which it was not. The four public fields used to sit
 * either side of the "Members only" fieldset — title and description above it,
 * location and the backdrop colour below — so the only marked group was the
 * private one, and the comment above that group claimed an ordering the form
 * did not have. Two named groups in the order somebody fills them in: what
 * everybody sees, then what only members do.
 *
 * Its own file since the suggestion feature grew a second slot in here. The
 * form it came from was within sight of the file-length limit, and the two
 * things this holds — the public inputs, and where a model's offers appear
 * beside them — are markup rather than behaviour, which is exactly the half
 * `PhotoEditForm` is better off without.
 */
export function PublicFields({
  photo,
  marks,
  suggest,
  choices,
  subjects,
}: {
  photo: OwnPhotoRow;
  marks: Marks;
  /**
   * The "Suggest details" control, or nothing at all.
   *
   * Passed in rather than decided here, because whether a model can be asked
   * anything is a fact about the deployment's environment and this component
   * runs in a browser. `aiSuggestionsConfigured()` is read on the server and
   * drilled down, the same way the map key is.
   *
   * Inside this fieldset and not beside the buttons at the foot of the form:
   * the fields it writes into are all here, and it belongs where its effect
   * is rather than where the other actions happen to live.
   */
  suggest: ReactNode;
  /**
   * The places a model offered, if it offered any.
   *
   * Directly under the Location field, because that is the field they fill
   * and a suggestion shown anywhere else is a suggestion about nothing in
   * particular. They are buttons: nothing here writes until one is clicked.
   */
  choices: ReactNode;
  /**
   * The subject chips, which sit at the foot of the group rather than beside
   * a field.
   *
   * There is no input for them to sit under — they *are* the control — and
   * the foot is where they belong for the same reason the places belong
   * under Location: a photographer works down this fieldset, and what a
   * photograph is *of* is the last public thing to decide, after the words
   * that say it. Below the backdrop swatch so the row of colour and the row
   * of chips do not compete on one line.
   */
  subjects: ReactNode;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className={`mb-1.5 ${META}`}>Public — everyone</legend>

      {suggest}

      <div className="space-y-1.5">
        <label className={LABEL} htmlFor={`title-${photo.id}`}>
          Title
        </label>
        {/*
          `maxLength`, from the same constant the server clamps with.

          `formText` trims and then slices to these lengths, so a longer title
          was quietly cut and answered with "Changes saved." — the
          photographer told their words were kept while half a sentence had
          gone. Stopping the typing at the limit is the only version that does
          not lie. The server still slices: a client cap is a courtesy, not a
          control.
        */}
        <input
          className={FIELD}
          defaultValue={photo.title}
          id={`title-${photo.id}`}
          maxLength={MAX_TITLE}
          name="title"
          placeholder="Uluwatu, Bali, Indonesia"
          required={true}
          {...marksFor(marks, "title")}
        />
      </div>

      <div className="space-y-1.5">
        <label className={LABEL} htmlFor={`description-${photo.id}`}>
          Description
        </label>
        <textarea
          className={FIELD}
          defaultValue={photo.description}
          id={`description-${photo.id}`}
          maxLength={MAX_DESCRIPTION}
          name="description"
          placeholder="Teal waves crash against rocky cliffs."
          required={true}
          rows={2}
          {...marksFor(marks, "description")}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <label className={LABEL} htmlFor={`location-${photo.id}`}>
            Location <span className={LABEL_HINT}>(optional)</span>
          </label>
          <input
            className={FIELD}
            defaultValue={photo.location ?? ""}
            id={`location-${photo.id}`}
            name="location"
            placeholder="Nusa Penida"
          />
          {choices}
        </div>

        <div className="space-y-1.5">
          <label className={LABEL} htmlFor={`color-${photo.id}`}>
            Backdrop
          </label>
          {/*
            Derived from the photo's dominant colour, but editable: the
            viewer tints the whole screen with it, and a chosen colour beats
            an averaged one.
          */}
          <input
            className="h-11 w-16 cursor-pointer rounded-xl border border-white/15 bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
            defaultValue={photo.bg_color}
            id={`color-${photo.id}`}
            name="bg_color"
            type="color"
            {...marksFor(marks, "bg_color")}
          />
        </div>
      </div>

      {subjects}
    </fieldset>
  );
}
