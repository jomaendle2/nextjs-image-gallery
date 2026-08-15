"use client";

import { useActionState, useCallback, useState } from "react";
import { ActionError } from "@/components/ui/ActionError";
import { FIELD, LABEL, LABEL_HINT } from "@/components/ui/field";
import { GlassButton } from "@/components/ui/glass-button";
import { useServerAction } from "@/hooks/useServerAction";
import type { OwnPhotoRow } from "@/lib/photos/types";
import {
  type PhotoFormState,
  removePhoto,
  savePhoto,
  togglePublished,
} from "./actions";

const INITIAL: PhotoFormState = { message: null };

/**
 * Everything about a photograph that a contributor can change.
 *
 * This is the whole stateful half of the dashboard row: form state, the
 * publish toggle, and the two-step delete. Splitting it from `PhotoCard`
 * leaves that component a shell — a thumbnail and its dimensions — with no
 * hooks at all, so the two things you might want to change (how a row looks,
 * and what a row can do) stop sharing a file.
 */
export function PhotoEditForm({ photo }: { photo: OwnPhotoRow }) {
  const [state, formAction, pending] = useActionState(savePhoto, INITIAL);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  /*
   * Server actions called from an event handler rather than through
   * formAction, so these buttons do not submit the surrounding edit form and
   * discard the contributor's unsaved title.
   *
   * The shared hook, not a private copy. This file used to carry its own
   * `run`, identical to the admin one down to the `router.refresh()` — and
   * identical in its one defect: no catch, so a failed unpublish or delete
   * threw into the error boundary and replaced the contributor's dashboard
   * with "That didn't load", losing every unsaved title on the page. One
   * implementation means fixing that once rather than finding it twice.
   */
  const { pending: isMutating, error: actionError, run } = useServerAction();

  const isPublished = photo.published_at !== null;
  const savedLabel = isPublished ? "Save changes" : "Publish";
  const submitLabel = pending ? "Saving…" : savedLabel;

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
        <legend className="px-1 text-[0.6875rem] text-white/40 uppercase tracking-[0.14em]">
          Members only
        </legend>

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
          <p className="text-[0.75rem] text-white/35 leading-relaxed">
            Only members see this, and only if you fill it in. Nothing is ever
            read from the file — your coordinates are still discarded.
          </p>
        </div>

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
        <GlassButton disabled={pending} size="sm" type="submit">
          {submitLabel}
        </GlassButton>

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
            <GlassButton
              className="text-white"
              disabled={isMutating}
              onClick={handleDelete}
              size="sm"
            >
              {isMutating ? "Deleting…" : "Really delete"}
            </GlassButton>
            <GlassButton onClick={cancelDelete} size="sm">
              Keep
            </GlassButton>
          </>
        ) : (
          <GlassButton
            className="text-white/60"
            disabled={isMutating}
            onClick={armDelete}
            size="sm"
          >
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
