"use client";

import { ExternalLink, Trash2 } from "lucide-react";
import { useActionState, useCallback, useEffect, useState } from "react";
import { IDLE } from "@/app/form-state";
import { ActionError } from "@/components/ui/ActionError";
import {
  FIELD,
  LABEL,
  LABEL_HINT,
  META,
  TOUCH_LINK,
} from "@/components/ui/field";
import { GlassButton } from "@/components/ui/glass-button";
import { Notice } from "@/components/ui/Notice";
import { useServerAction } from "@/hooks/useServerAction";
import type { OwnPhotoRow } from "@/lib/photos/types";
import {
  type PhotoField,
  type PhotoFormState,
  removePhoto,
  savePhoto,
  togglePublished,
} from "./actions";
import { LocationPicker } from "./LocationPicker";

const INITIAL: PhotoFormState = IDLE;

/**
 * Which element a refused field belongs to.
 *
 * The action names fields by their `name` attribute; the ids in this form are
 * built from a prefix and the photograph's id, and two of the prefixes differ
 * from the field name — `bg_color` is the input called `color-…`. One table
 * rather than a chain of ternaries at the one call site that needs it, so
 * adding a field is a line here rather than a branch somewhere.
 */
const ELEMENT_PREFIX: Record<PhotoField, string> = {
  title: "title",
  description: "description",
  bg_color: "color",
  pin: "pin",
};

/**
 * The field the last save refused, and where the sentence explaining it is.
 *
 * Passed down as one object rather than two props because the two are only
 * ever useful together: a field marked `aria-invalid` with no
 * `aria-describedby` tells somebody using a screen reader that something is
 * wrong and not what. WCAG 3.3.1 wants the identification and the description,
 * and they are one thought.
 */
interface Marks {
  field: PhotoField | undefined;
  messageId: string;
}

/**
 * The two attributes that make a refusal reach assistive technology.
 *
 * Absent rather than `aria-invalid={false}` on the fields that are fine: an
 * explicit false is legal and is also one more state to keep in step, and the
 * default is already "valid".
 */
function marksFor(marks: Marks, field: PhotoField) {
  return marks.field === field
    ? { "aria-describedby": marks.messageId, "aria-invalid": true }
    : {};
}

/**
 * Everything anybody who visits the site can read.
 *
 * Grouped and labelled, which it was not. The four public fields used to sit
 * either side of the "Members only" fieldset — title and description above it,
 * location and the backdrop colour below — so the only marked group was the
 * private one, and the comment above that group claimed an ordering the form
 * did not have. Two named groups in the order somebody fills them in: what
 * everybody sees, then what only members do.
 */
function PublicFields({ photo, marks }: { photo: OwnPhotoRow; marks: Marks }) {
  return (
    <fieldset className="space-y-3">
      <legend className={`mb-1.5 ${META}`}>Public — everyone</legend>

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
    </fieldset>
  );
}

/** The three fields a membership pays for, and the consent that goes with. */
function MemberFields({
  photo,
  mapStyleUrl,
  marks,
}: {
  photo: OwnPhotoRow;
  mapStyleUrl: string | null;
  marks: Marks;
}) {
  return (
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
            to everyone, including people who have not paid. Only one photograph
            is used at a time.
          </span>
        </span>
      </label>
    </fieldset>
  );
}

/**
 * What the last save said, in the tone it said it in.
 *
 * The message used to render as one flat `text-white/55` line that threw
 * `state.tone` away, so "A title and a description are both required." looked
 * exactly like "Published." — the only way to tell good news from bad was to
 * read it, on the one page where somebody is doing the same thing twenty times
 * in a row. Every other form on the site hands its tone to `Notice`; this one
 * now does too.
 *
 * The link is the other half of the fix. "Published." was the end of the road:
 * the next thing anybody wants is to look at what they just published, and
 * there was nowhere on this page to do that. It is offered on any successful
 * save of a live photograph, not only on the publish itself, because "did my
 * edit land" is the same question.
 */
function SaveResult({
  state,
  photo,
  id,
}: {
  state: PhotoFormState;
  photo: OwnPhotoRow;
  id: string;
}) {
  const isError = state.tone === "error";

  return (
    <div className="w-full" id={id}>
      <Notice tone={isError ? "error" : "success"}>
        <div className="flex flex-wrap items-center gap-x-4">
          <span>{state.message}</span>
          {isError || photo.published_at === null ? null : (
            <a
              className={`${TOUCH_LINK} underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current`}
              href={`/photo/${photo.id}`}
              rel="noreferrer"
              target="_blank"
            >
              See it on the site
              <ExternalLink aria-hidden="true" className="ml-1.5" size={13} />
            </a>
          )}
        </div>
      </Notice>
    </div>
  );
}

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
   * Whether the message on screen still describes the form on screen.
   *
   * It used to persist for the life of the page, so a stale "Published." sat
   * under the form while the next save was in flight and while the next title
   * was being typed — a status line that keeps saying yes is indistinguishable
   * from one that has stopped listening. Any edit retires it, and so does the
   * submit that is about to replace it.
   */
  const [stale, setStale] = useState(false);
  const retireMessage = useCallback(() => setStale(true), []);
  const awaitMessage = useCallback(() => setStale(false), []);

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
  const messageId = `save-result-${photo.id}`;
  const showMessage = state.message !== null && !stale && !pending;
  const marks: Marks = {
    field: showMessage ? state.field : undefined,
    messageId,
  };

  /*
   * The cursor goes to the field that was refused.
   *
   * Without this, the only evidence of a refusal was a sentence below the
   * submit button — off screen on a phone, and never announced as belonging to
   * any control. Moving focus answers "which one" with the one gesture nobody
   * can miss, and it scrolls the field into view on the way.
   *
   * By id rather than through a ref, because two of the four markable fields
   * live inside child components and threading a ref down through them would
   * make where the cursor goes a property of three files instead of one.
   */
  useEffect(() => {
    if (state.field === undefined) {
      return;
    }
    document
      .getElementById(`${ELEMENT_PREFIX[state.field]}-${photo.id}`)
      ?.focus();
  }, [state, photo.id]);

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
    <form
      action={formAction}
      className="flex-1 space-y-3"
      onChange={retireMessage}
      onSubmit={awaitMessage}
    >
      <input name="id" type="hidden" value={photo.id} />

      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ${
            isPublished
              ? "bg-white/15 text-white/90"
              : "bg-white/5 text-white/55"
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

      <PublicFields marks={marks} photo={photo} />

      <MemberFields mapStyleUrl={mapStyleUrl} marks={marks} photo={photo} />

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
      </div>

      {showMessage ? (
        <SaveResult id={messageId} photo={photo} state={state} />
      ) : null}

      {/* Unpublish and delete report here; the save button reports above. */}
      <ActionError message={actionError} />
    </form>
  );
}
