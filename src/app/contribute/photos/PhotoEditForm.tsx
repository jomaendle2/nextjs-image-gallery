"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useCallback, useState } from "react";
import { IDLE } from "@/app/form-state";
import { ActionError } from "@/components/ui/ActionError";
import { FIELD, LABEL, LABEL_HINT, META } from "@/components/ui/field";
import { GlassButton } from "@/components/ui/glass-button";
import { useServerAction } from "@/hooks/useServerAction";
import type { OwnPhotoRow } from "@/lib/photos/types";
import {
  type PhotoFormState,
  removePhoto,
  savePhoto,
  togglePublished,
} from "./actions";
import { LocationPicker } from "./LocationPicker";

const INITIAL: PhotoFormState = IDLE;

/**
 * Everything about a photograph that a contributor can change.
 *
 * This is the whole stateful half of the dashboard row: form state, the
 * publish toggle, and the two-step delete. Splitting it from `PhotoCard`
 * leaves that component a shell — a thumbnail and its dimensions — with no
 * hooks at all, so the two things you might want to change (how a row looks,
 * and what a row can do) stop sharing a file.
 */
export function PhotoEditForm({
  photo,
  mapStyleUrl,
}: {
  photo: OwnPhotoRow;
  /** Null when no `MAPTILER_KEY` is set; the picker says so and still works. */
  mapStyleUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState(savePhoto, INITIAL);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  /*
   * Server actions called from an event handler rather than through
   * formAction, so these buttons do not submit the surrounding edit form and
   * discard the contributor's unsaved title.
   *
   * The shared hook rather than a private copy: it catches, so a failed
   * unpublish does not throw into the error boundary and replace the
   * dashboard — which would lose every unsaved title on the page.
   */
  const { pending: isMutating, error: actionError, run } = useServerAction();

  const isPublished = photo.published_at !== null;
  const saveLabel = pending ? "Saving…" : "Save changes";

  const handleUnpublish = useCallback(() => {
    run(() => togglePublished(photo.id, false));
  }, [run, photo.id]);

  const handleDelete = useCallback(() => {
    run(() => removePhoto(photo.id));
  }, [run, photo.id]);

  const armDelete = useCallback(() => {
    setConfirmingDelete(true);
  }, []);

  const cancelDelete = useCallback(() => {
    setConfirmingDelete(false);
  }, []);

  return (
    <form action={formAction} className="flex-1 space-y-3">
      <input name="id" type="hidden" value={photo.id} />

      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ${
            isPublished
              ? "bg-white/15 text-white/90"
              : "bg-white/5 text-white/50"
          }`}
        >
          {isPublished ? "Published" : "Draft"}
        </span>
        {photo.is_opener ? (
          <span className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-1 text-white/90 text-xs">
            Opening photo
          </span>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label className={LABEL} htmlFor={`title-${photo.id}`}>
          Title
        </label>
        <input
          className={FIELD}
          defaultValue={photo.title}
          id={`title-${photo.id}`}
          name="title"
          placeholder="Uluwatu, Bali, Indonesia"
          required={true}
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
          name="description"
          placeholder="Teal waves crash against rocky cliffs."
          required={true}
          rows={2}
        />
      </div>

      {/*
        The two member-only fields, kept together and marked as such. They
        sit below the public ones because that is the order somebody fills
        them in: what everybody sees, then what only members do.
      */}
      <fieldset className="space-y-3 rounded-2xl border border-white/[0.08] p-3.5">
        <legend className={`px-1 ${META}`}>Members only</legend>
        {/*
          The one consequence the "Members only" legend above does not
          describe, said where the decision is made.

          Everything else in this fieldset is member-gated end to end. A pin
          is not: it is stored at two precisions, and the blunt one is public
          by design, because a globe anybody can browse is the whole reason
          the field exists. Somebody filling in this box has to be told that
          before they fill it in, not afterwards.
        */}
        <p className={META}>
          A marked spot is the one thing here with a public half
        </p>

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
          <p className="text-[0.75rem] text-white/55 leading-relaxed">
            Only members see this, and only if you fill it in. Nothing is ever
            read from the file — the GPS block is never opened, so whatever you
            write down here is the only place this site learns about.
          </p>
        </div>

        <LocationPicker photo={photo} styleUrl={mapStyleUrl} />

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

          Unchecked by default, and the box says plainly what saying yes
          means — this text becomes readable by anyone, including people who
          have not paid.
        */}
        <label
          className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/[0.08] p-3"
          htmlFor={`specimen-${photo.id}`}
        >
          <input
            className="mt-0.5 size-4 flex-shrink-0 accent-white"
            defaultChecked={photo.is_specimen}
            id={`specimen-${photo.id}`}
            name="is_specimen"
            type="checkbox"
          />
          <span className="space-y-1">
            <span className="block font-medium text-sm text-white/85">
              Use this one as the public example
            </span>
            <span className="block text-[0.75rem] text-white/55 leading-relaxed">
              The two fields above will be shown in full on the membership page,
              to everyone, including people who have not paid. Only one
              photograph is used at a time.
            </span>
          </span>
        </label>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 space-y-1.5">
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
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        {/*
          Two buttons, because saving and publishing are two decisions. One
          button meant a photographer could not write a title without the
          photograph going live, so captioning an evening's uploads pushed
          each one into the feed and the announcement queue and then pulled
          it back. `name="intent"` is how the server learns which was pressed.
        */}
        <GlassButton
          disabled={pending}
          name="intent"
          size="sm"
          type="submit"
          value="save"
        >
          {saveLabel}
        </GlassButton>

        {isPublished ? null : (
          <GlassButton
            disabled={pending}
            name="intent"
            size="sm"
            type="submit"
            value="publish"
            variant="primary"
          >
            {pending ? "Publishing…" : "Publish"}
          </GlassButton>
        )}

        {isPublished ? (
          <GlassButton
            disabled={isMutating}
            onClick={handleUnpublish}
            size="sm"
          >
            Unpublish
          </GlassButton>
        ) : null}

        {/*
          Two steps rather than a confirm dialog. Deleting removes the blob as
          well as the row, so it is the one irreversible action on this page.
        */}
        {confirmingDelete ? (
          <>
            {/*
              The only irreversible control on the site, and until now it
              looked exactly like the button next to it: same glass, same
              weight, same size. On a phone that is two near-identical
              targets a thumb-width apart, one of which destroys a
              photograph and its blob. Red, an icon, and the safe option
              listed first — so the destructive one is neither the default
              nor the nearest thing to your thumb.
            */}
            <GlassButton autoFocus={true} onClick={cancelDelete} size="sm">
              Keep
            </GlassButton>
            <GlassButton
              variant="danger"
              disabled={isMutating}
              onClick={handleDelete}
              size="sm"
            >
              <Trash2 aria-hidden="true" className="mr-1.5" size={14} />
              {isMutating ? "Deleting…" : "Delete for good"}
            </GlassButton>
          </>
        ) : (
          <GlassButton
            variant="arm"
            disabled={isMutating}
            onClick={armDelete}
            size="sm"
          >
            <Trash2 aria-hidden="true" className="mr-1.5" size={14} />
            Delete
          </GlassButton>
        )}

        <p aria-live="polite" className="text-sm text-white/55">
          {state.message}
        </p>
      </div>

      {/* Unpublish and delete report here; the save button reports above. */}
      <ActionError message={actionError} />
    </form>
  );
}
