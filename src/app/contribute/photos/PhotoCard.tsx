"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useState, useTransition } from "react";
import { GlassButton } from "@/components/ui/glass-button";
import type { PhotoExif } from "@/lib/photos/derive";
import type { OwnPhotoRow } from "@/lib/photos/types";
import {
  type PhotoFormState,
  removePhoto,
  savePhoto,
  togglePublished,
} from "./actions";

const INITIAL: PhotoFormState = { message: null };

function exifSummary(exif: PhotoExif | null): string | null {
  if (!exif) {
    return null;
  }
  const parts = [
    exif.camera,
    exif.lens,
    exif.focal_length,
    exif.aperture,
    exif.shutter,
    exif.iso === undefined ? undefined : `ISO ${exif.iso}`,
  ].filter((part): part is string => part !== undefined);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function PhotoCard({ photo }: { photo: OwnPhotoRow }) {
  const [state, formAction, pending] = useActionState(savePhoto, INITIAL);
  const [isMutating, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const router = useRouter();

  const isPublished = photo.published_at !== null;
  const exif = exifSummary(photo.exif);
  const savedLabel = isPublished ? "Save changes" : "Publish";
  const submitLabel = pending ? "Saving…" : savedLabel;

  /*
   * Server actions called from an event handler rather than through
   * formAction, so these buttons do not submit the surrounding edit form and
   * discard the contributor's unsaved title.
   */
  const run = useCallback(
    (work: () => Promise<void>) => {
      startTransition(async () => {
        await work();
        router.refresh();
      });
    },
    [router],
  );

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
    <li className="rounded-3xl border border-white/12 bg-white/5 p-5">
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="sm:w-[200px] sm:shrink-0">
          {/*
            Fixed 4:3 box. Left to its own aspect ratio, a portrait original
            made its row three times taller than a landscape one and the list
            became impossible to scan.
          */}
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-white/5">
            <Image
              alt={photo.title === "" ? "Uploaded photograph" : photo.title}
              blurDataURL={photo.blur_data_url}
              className="object-cover"
              fill={true}
              placeholder="blur"
              sizes="(max-width: 640px) 100vw, 200px"
              src={photo.blob_url}
            />
          </div>
          <p className="mt-2 text-white/40 text-xs tabular-nums">
            {photo.width} × {photo.height}
          </p>
          {exif === null ? null : (
            <p className="mt-1 text-pretty text-white/40 text-xs">{exif}</p>
          )}
        </div>

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
            <label
              className="block font-medium text-sm text-white/70"
              htmlFor={`title-${photo.id}`}
            >
              Title
            </label>
            <input
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
              defaultValue={photo.title}
              id={`title-${photo.id}`}
              name="title"
              placeholder="Uluwatu, Bali, Indonesia"
              required={true}
            />
          </div>

          <div className="space-y-1.5">
            <label
              className="block font-medium text-sm text-white/70"
              htmlFor={`description-${photo.id}`}
            >
              Description
            </label>
            <textarea
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
              defaultValue={photo.description}
              id={`description-${photo.id}`}
              name="description"
              placeholder="Teal waves crash against rocky cliffs."
              required={true}
              rows={2}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex-1 space-y-1.5">
              <label
                className="block font-medium text-sm text-white/70"
                htmlFor={`location-${photo.id}`}
              >
                Location <span className="text-white/35">(optional)</span>
              </label>
              <input
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
                defaultValue={photo.location ?? ""}
                id={`location-${photo.id}`}
                name="location"
                placeholder="Nusa Penida"
              />
            </div>

            <div className="space-y-1.5">
              <label
                className="block font-medium text-sm text-white/70"
                htmlFor={`color-${photo.id}`}
              >
                Backdrop
              </label>
              {/*
                Derived from the photo's dominant colour, but editable: the
                viewer tints the whole screen with it, and a chosen colour
                beats an averaged one.
              */}
              <input
                className="h-[38px] w-16 cursor-pointer rounded-xl border border-white/15 bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
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
              Two steps rather than a confirm dialog. Deleting removes the
              blob as well as the row, so it is the one irreversible action
              on this page.
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
        </form>
      </div>
    </li>
  );
}
