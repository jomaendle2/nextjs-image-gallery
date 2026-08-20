"use client";

import { Check, Plus } from "lucide-react";
import { useCallback } from "react";
import { META } from "@/components/ui/field";
import { MAX_PHOTO_TAGS, type PhotoTag } from "@/lib/photos/tags";

/**
 * The subjects a photograph is filed under, and the ones a model thinks it
 * should be.
 *
 * The same bargain `PlaceChoices` makes, in the same shape: a model may say
 * what it thinks, and nothing it says reaches the database until somebody
 * presses it. What differs is only what a wrong answer costs. A wrong place
 * puts a dot on a public map, so a place is offered twice — once as a name,
 * once as a point — and the auto-fill it has now is guarded by a confidence
 * the model reports. A wrong subject files a photograph under "desert" when
 * it is a beach; that is worth a click and not worth a confidence, because
 * unlike a place the photographer can check it against the photograph in
 * front of them without leaving the page.
 *
 * So there is no auto-fill here at all, deliberately, and no hedge on the
 * chips. Every tag on a photograph was chosen by the person who took it.
 */

/**
 * One tag, as a button that adds or removes it.
 *
 * A single control for both directions rather than a chip with a small × on
 * it. The × is the conventional answer and it is wrong at this size: it puts
 * a four-millimetre target inside an eleven-millimetre one, so on a phone the
 * gesture that removes a tag and the gesture that does nothing are the same
 * gesture aimed slightly differently. Pressing the whole chip toggles it, and
 * the icon says which way it will go.
 */
function Tag({
  tag,
  chosen,
  disabled,
  onToggle,
}: {
  tag: PhotoTag;
  chosen: boolean;
  /**
   * The list is full and this one is not on it.
   *
   * Shown rather than hidden, because a chip that vanishes when a fifth tag
   * is picked looks like the interface losing track. It stays, dimmed, and
   * the count beside the label says why.
   */
  disabled: boolean;
  onToggle: (tag: PhotoTag) => void;
}) {
  const toggle = useCallback(() => onToggle(tag), [onToggle, tag]);

  return (
    <li>
      {/*
        `type="button"`, for the reason `PlaceChoices` gives at length: these
        sit inside the edit form, and a bare button in a form submits it —
        so picking a subject would save the photograph, which is the one
        thing this feature promises not to do.
      */}
      <button
        aria-pressed={chosen}
        className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 disabled:cursor-default disabled:opacity-40 ${
          chosen
            ? "border-white/25 bg-white/15 text-white/90"
            : "border-white/[0.08] text-white/70 hover:enabled:border-white/20 hover:enabled:text-white/90"
        }`}
        disabled={disabled}
        onClick={toggle}
        type="button"
      >
        {chosen ? (
          <Check aria-hidden="true" className="shrink-0" size={13} />
        ) : (
          <Plus aria-hidden="true" className="shrink-0" size={13} />
        )}
        {tag}
      </button>
    </li>
  );
}

export function TagChoices({
  photoId,
  chosen,
  suggested,
  onToggle,
}: {
  /** Every row on this page has one of these, so the label needs an id. */
  photoId: string;
  chosen: readonly PhotoTag[];
  /**
   * What the last run proposed, which may be nothing.
   *
   * Kept separate from `chosen` rather than merged, so a tag the
   * photographer removed after accepting it does not silently come back as
   * a suggestion they have to decline twice.
   */
  suggested: readonly PhotoTag[];
  onToggle: (tag: PhotoTag) => void;
}) {
  /*
   * Chosen first, then anything still on offer. One row of chips rather than
   * two lists, because "the subjects of this photograph" and "the subjects a
   * model guessed" are the same question asked before and after a decision —
   * and a photographer scanning two rows has to work out which is which.
   */
  const offered = suggested.filter((tag) => !chosen.includes(tag));
  if (chosen.length === 0 && offered.length === 0) {
    return null;
  }

  const full = chosen.length >= MAX_PHOTO_TAGS;
  const labelId = `tags-${photoId}`;

  return (
    <div className="space-y-1.5">
      <p className={META} id={labelId}>
        Subjects {full ? `— ${MAX_PHOTO_TAGS} is the most` : "— click to keep"}
      </p>
      <ul aria-labelledby={labelId} className="flex flex-wrap gap-1.5">
        {[...chosen, ...offered].map((tag) => (
          <Tag
            chosen={chosen.includes(tag)}
            disabled={full && !chosen.includes(tag)}
            key={tag}
            onToggle={onToggle}
            tag={tag}
          />
        ))}
      </ul>

      {/*
        The set, as the form submits it.

        One input per tag rather than a comma-joined string, so the server
        reads `getAll("tags")` and never has to split anything — and so an
        empty set posts nothing at all, which is the same shape as a
        photograph that never had tags.
      */}
      {chosen.map((tag) => (
        <input key={tag} name="tags" type="hidden" value={tag} />
      ))}
    </div>
  );
}
