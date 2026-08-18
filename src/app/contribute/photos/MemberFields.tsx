"use client";

import { ChevronDown } from "lucide-react";
import type { SyntheticEvent } from "react";
import { FIELD, LABEL, LABEL_HINT, META } from "@/components/ui/field";
import type { OwnPhotoRow } from "@/lib/photos/types";
import { LocationPicker } from "./LocationPicker";
import type { Marks } from "./marks";
import { memberSummary } from "./members";
import { Why } from "./Why";

/**
 * The three fields a membership pays for, and the consent that goes with.
 *
 * Closed when a row opens. Most edits on this page are a title and a
 * description — the three fields below them were making every form twice as
 * tall as the work being done in it, and a photographer captioning an
 * evening's uploads scrolled past all of it forty times.
 *
 * Closed, but never silent about it: the summary counts what is already
 * written, because a collapsed box that looks the same whether it holds
 * somebody's notes or nothing is how writing gets forgotten and then
 * overwritten. And it opens itself when a save is refused for the pin, which
 * is the one field in here the server can reject — a cursor moved to a
 * control inside a closed disclosure is a cursor nobody can see.
 */
export function MemberFields({
  photo,
  mapStyleUrl,
  marks,
  open,
  onToggle,
}: {
  photo: OwnPhotoRow;
  mapStyleUrl: string | null;
  marks: Marks;
  open: boolean;
  onToggle: (event: SyntheticEvent<HTMLDetailsElement>) => void;
}) {
  return (
    <details
      className="group rounded-2xl border border-white/[0.08]"
      onToggle={onToggle}
      open={open}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 p-3.5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white/80 [&::-webkit-details-marker]:hidden">
        <span className={META}>Members only</span>
        <span className="min-w-0 flex-1 truncate text-[0.75rem] text-white/55">
          {memberSummary(photo)}
        </span>
        <ChevronDown
          aria-hidden="true"
          className="shrink-0 text-white/50 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
          size={15}
        />
      </summary>

      {/*
        A plain `<div>` inside rather than a `<fieldset>` around everything.
        A `<fieldset>` cannot be the child of a `<summary>`'s sibling and keep
        its legend where the legend belongs, and the summary above is now
        doing the naming a legend used to do.
      */}
      <div className="space-y-3 p-3.5 pt-0">
        <div className="space-y-1.5">
          <label className={LABEL} htmlFor={`precise-${photo.id}`}>
            Where you stood <span className={LABEL_HINT}>(optional)</span>
          </label>
          <input
            className={FIELD}
            defaultValue={photo.precise_location ?? ""}
            id={`precise-${photo.id}`}
            name="precise_location"
            placeholder="The pull-off below the second switchback"
          />
          <Why summary="Only members see this, and only if you fill it in.">
            Nothing is ever read from the file — the GPS block is never opened,
            so whatever you write down here is the only place this site learns
            about. A marked spot is the one thing in this section with a public
            half: it is stored at two precisions, and the blunt one is public by
            design, because a globe anybody can browse is the whole reason the
            field exists.
          </Why>
        </div>

        <LocationPicker
          invalid={marks.field === "pin"}
          messageId={marks.messageId}
          photo={photo}
          styleUrl={mapStyleUrl}
        />

        <div className="space-y-1.5">
          <label className={LABEL} htmlFor={`technique-${photo.id}`}>
            How you made it <span className={LABEL_HINT}>(optional)</span>
          </label>
          <textarea
            className={FIELD}
            defaultValue={photo.technique ?? ""}
            id={`technique-${photo.id}`}
            name="technique"
            placeholder="Waited about forty minutes for the cloud to clear the ridge."
            rows={2}
          />
        </div>

        {/*
          Consent to be the public example, asked here rather than assumed.

          `/membership` shows one photograph's member fields to everybody, so
          somebody deciding whether five euros is worth it can read the actual
          writing instead of a promise about it. Which photograph that is has
          to be the photographer's choice: picking it by query would publish
          their words because of when they typed them.

          Unchecked by default. The consequence stays on screen rather than
          folding into the `Why` beneath it — "shown to everyone, including
          people who have not paid" is the whole of what is being agreed to,
          and a consent whose consequence needs a click is not consent.
        */}
        <div className="space-y-1.5 rounded-xl border border-white/[0.08] p-3">
          <label
            className="flex cursor-pointer items-start gap-3"
            htmlFor={`specimen-${photo.id}`}
          >
            <input
              className="mt-0.5 size-4 flex-shrink-0 accent-white"
              defaultChecked={photo.is_specimen}
              id={`specimen-${photo.id}`}
              name="is_specimen"
              type="checkbox"
            />
            <span>
              <span className="block font-medium text-sm text-white/85">
                Use this one as the public example
              </span>
              <span className="mt-0.5 block text-[0.75rem] text-white/55 leading-relaxed">
                Shown to everyone, including people who have not paid.
              </span>
            </span>
          </label>
          <Why summary="One photograph is used at a time.">
            The two fields above are shown in full on the membership page, so
            somebody deciding whether it is worth paying for can read the actual
            writing instead of a promise about it. Ticking this on another
            photograph moves the example there.
          </Why>
        </div>
      </div>
    </details>
  );
}
