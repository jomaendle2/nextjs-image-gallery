"use client";

import { MapPin } from "lucide-react";
import { useCallback } from "react";
import { META } from "@/components/ui/field";
import type { PlaceGuess } from "@/lib/ai/suggestion";

/**
 * The places a model thought this photograph might be, offered rather than
 * applied.
 *
 * This component is why the model is now allowed to say what it is unsure
 * of. The old rule deleted a hedged guess before anybody saw it, and the
 * reasoning was sound as far as it went: `/globe` is built from these
 * strings, and a filled field reads as a fact to the person confirming it.
 * What that argument was really about was *writing*, not *knowing* — so the
 * guess now lands on a button instead of in a box, and the field it would
 * fill stays exactly as the photographer left it until they click.
 *
 * Two decisions per candidate, not one. Accepting the name writes a place
 * somebody will read; accepting the point puts a marker on a map that half
 * of it is public. A model that recognises a coastline correctly and places
 * it forty kilometres along that coastline is the ordinary case, so those
 * cannot be the same click.
 */

/**
 * The verdict, in the two words it is worth.
 *
 * Plain adjectives rather than a percentage or a bar. The model reports one
 * of two states and neither of them is a measurement; dressing that up as a
 * number would make a guess look like an instrument reading.
 */
const CONFIDENCE_LABEL = {
  high: "sure",
  low: "less sure",
} as const;

function Choice({
  place,
  busy,
  onName,
  onPoint,
}: {
  place: PlaceGuess;
  /**
   * The run is still streaming, so this name may be a prefix.
   *
   * A chip renders as soon as it has a name — that is deliberate, and it is
   * what makes the feature look like it is working. But the name is being
   * written a character at a time, so "Nusa Penida" is "Nusa Pen" for a
   * moment, and clicking it there wrote that into the Location field. Nothing
   * sweeps it afterwards: `settle` only puts back the two text fields it
   * touched, so a truncated place name survives the run, gets saved, and ends
   * up on the globe. Shown, and not yet clickable, is the honest state.
   */
  busy: boolean;
  onName: (place: PlaceGuess) => void;
  onPoint: (place: PlaceGuess) => void;
}) {
  /*
   * The candidate is bound to its handler here rather than in the list
   * above, so mapping over two places does not mint two new functions on
   * every keystroke elsewhere in the form. Same reason the row list is
   * memoized at all.
   */
  const takeName = useCallback(() => onName(place), [onName, place]);
  const takePoint = useCallback(() => onPoint(place), [onPoint, place]);

  return (
    <li className="space-y-1.5 rounded-xl border border-white/[0.08] p-2.5">
      {/*
        `type="button"` throughout. These sit inside the edit form, and a
        button in a form submits it by default — clicking a suggestion would
        save the photograph, which is the one thing this feature promises not
        to do.
      */}
      <button
        className="-mx-2 -my-1.5 flex min-h-11 w-full items-baseline gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 disabled:cursor-default disabled:hover:bg-transparent"
        disabled={busy}
        onClick={takeName}
        type="button"
      >
        <span className="min-w-0 flex-1 truncate font-medium text-sm text-white/85">
          {place.name}
        </span>
        <span className={`shrink-0 ${META}`}>
          {CONFIDENCE_LABEL[place.confidence]}
        </span>
      </button>

      {place.reason === "" ? null : (
        <p className="text-[0.75rem] text-white/55 leading-relaxed">
          {place.reason}
        </p>
      )}

      {place.point === null ? null : (
        <button
          className="-mx-2 -my-2 inline-flex min-h-11 items-center rounded-lg px-2 py-2 text-[0.75rem] text-white/55 underline underline-offset-2 transition-colors hover:text-white/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 disabled:cursor-default disabled:no-underline"
          disabled={busy}
          onClick={takePoint}
          type="button"
        >
          <MapPin aria-hidden="true" className="mr-1.5 shrink-0" size={13} />
          Put a pin roughly here
        </button>
      )}
    </li>
  );
}

export function PlaceChoices({
  photoId,
  places,
  answered,
  onName,
  onPoint,
}: {
  /** Every row on this page has one of these, so the label needs an id. */
  photoId: string;
  places: PlaceGuess[];
  /**
   * Whether a run has finished. An empty list means two different things
   * before and after that, and only one of them is worth a sentence.
   */
  answered: boolean;
  onName: (place: PlaceGuess) => void;
  onPoint: (place: PlaceGuess) => void;
}) {
  if (places.length === 0) {
    /*
     * Said out loud, because a row of chips that never appears looks exactly
     * like the feature half-working. This replaces the sentence that used to
     * report a *withheld* place — there is nothing withheld now, so what is
     * left to report is the plain fact that the frame pointed nowhere.
     */
    return answered ? (
      <p className="text-[0.75rem] text-white/55 leading-relaxed">
        Nothing in the frame pointed anywhere, so the location is untouched.
      </p>
    ) : null;
  }

  const labelId = `places-${photoId}`;

  return (
    <div className="space-y-1.5">
      <p className={META} id={labelId}>
        Places it suggests — click one to use it
      </p>
      <ul aria-labelledby={labelId} className="space-y-1.5">
        {/*
          Keyed by position, not by content.

          The name arrives a character at a time, so a content key changed on
          every chunk — remounting the row and its buttons per token, which
          drops focus from a chip somebody had tabbed to and can swap the
          button under a cursor mid-click. Two candidates with the same name
          and confidence would also collide. The list is positional, capped at
          two, and replaced wholesale, so the index is the stable identity.
        */}
        {places.map((place, index) => (
          <Choice
            busy={!answered}
            // biome-ignore lint/suspicious/noArrayIndexKey: position IS the identity — the name streams a character at a time, so a content key remounts the row per token and drops focus from a chip. The list is capped at two and replaced wholesale, never reordered or spliced.
            key={index}
            onName={onName}
            onPoint={onPoint}
            place={place}
          />
        ))}
      </ul>
    </div>
  );
}
