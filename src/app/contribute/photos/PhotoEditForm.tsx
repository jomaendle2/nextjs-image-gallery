"use client";

import { ExternalLink, Trash2 } from "lucide-react";
import {
  type SyntheticEvent,
  useActionState,
  useCallback,
  useEffect,
  useState,
} from "react";
import { IDLE } from "@/app/form-state";
import { ActionError } from "@/components/ui/ActionError";
import { TOUCH_LINK } from "@/components/ui/field";
import { GlassButton } from "@/components/ui/glass-button";
import { Notice } from "@/components/ui/Notice";
import { useServerAction } from "@/hooks/useServerAction";
import type { PlaceGuess } from "@/lib/ai/suggestion";
import { MAX_PHOTO_TAGS, type PhotoTag } from "@/lib/photos/tags";
import type { OwnPhotoRow } from "@/lib/photos/types";
import {
  type PhotoField,
  type PhotoFormState,
  removePhoto,
  savePhoto,
  togglePublished,
} from "./actions";
import { MemberFields } from "./MemberFields";
import type { Marks } from "./marks";
import { PlaceChoices } from "./PlaceChoices";
import { PublicFields } from "./PublicFields";
import { SuggestDetails } from "./SuggestDetails";
import { TagChoices } from "./TagChoices";
import { setUnsaved } from "./unsaved";
import { useSuggestion } from "./useSuggestion";

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
  aiOffered,
}: {
  photo: OwnPhotoRow;
  /** Null when no `MAPTILER_KEY` is set; the picker says so and still works. */
  mapStyleUrl: string | null;
  /**
   * Whether a model can be asked to look at a photograph at all.
   *
   * False is a working gallery, not a broken one — the button is simply not
   * there, and photographers write their own titles as they always have. The
   * route answers a request that arrives anyway with a 503 and a sentence.
   */
  aiOffered: boolean;
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

  /*
   * Whether the members-only section is open.
   *
   * Closed on every open of a row, deliberately — including for a photograph
   * whose member fields are already written. The summary counts those, so
   * nothing is hidden without being announced, and a form that reopens in the
   * state you last left it in is a form whose height changes for reasons the
   * person cannot see.
   *
   * Controlled rather than left to the element, because a refused save has to
   * be able to open it. The `onToggle` handler is what keeps the state in
   * step with the clicks that are not ours.
   */
  const [membersOpen, setMembersOpen] = useState(false);
  const toggleMembers = useCallback(
    (event: SyntheticEvent<HTMLDetailsElement>) => {
      setMembersOpen(event.currentTarget.open);
    },
    [],
  );
  const retireMessage = useCallback(() => setStale(true), []);
  const awaitMessage = useCallback(() => setStale(false), []);

  /*
   * The subjects this photograph carries, which is form state rather than
   * DOM state.
   *
   * Everything else in this form is an uncontrolled input with a
   * `defaultValue`, read back by the action out of `FormData` — which is the
   * right shape for a box somebody types in. A set of chips is not: there is
   * no single element holding it, the same tag has to render pressed in one
   * place and absent from another, and the count has to gate the controls.
   * So it is held here and submitted as hidden inputs.
   *
   * Seeded from the row and never re-seeded. A photograph whose tags change
   * on the server while somebody is editing it is the same conflict as a
   * title that does, and this form has always answered that the same way:
   * what you are looking at is what you will save.
   */
  const [tags, setTags] = useState<PhotoTag[]>(photo.tags);

  const toggleTag = useCallback(
    (tag: PhotoTag) => {
      setTags((current) => {
        if (current.includes(tag)) {
          return current.filter((each) => each !== tag);
        }
        /*
         * A press that would be the sixth does nothing rather than pushing
         * the oldest out. The chip is disabled, so this is unreachable by
         * mouse — it is here for the keyboard and for the moment between a
         * suggestion landing and the render that dims it.
         */
        return current.length >= MAX_PHOTO_TAGS ? current : [...current, tag];
      });
      /*
       * By hand, for the reason `useSuggestion` documents about setting
       * `.value` from script: this changes what a save would write, but it
       * fires no `change` event, so without this the form's last
       * "Changes saved." would sit under a set of subjects it never saw —
       * and `UnsavedGuard` would let the page be left with them unsaved.
       */
      retireMessage();
    },
    [retireMessage],
  );

  /*
   * `stale` already means "changed since the last save", which is exactly the
   * question `UnsavedGuard` asks — so it is reported rather than tracked a
   * second time. Cleared on the way out too: a row that unmounts has taken
   * its text with it whatever we do, and leaving the id behind would warn
   * about a form that no longer exists.
   */
  useEffect(() => {
    setUnsaved(photo.id, stale);
    return () => {
      setUnsaved(photo.id, false);
    };
  }, [photo.id, stale]);

  /*
   * The suggestion run lives here rather than inside the button.
   *
   * It used to live in `SuggestDetails`, which was right while everything it
   * touched was in one fieldset. It is not any more: the button is in the
   * public group, the chips it produces belong under the Location field, and
   * a coordinate somebody accepts has to reach the picker inside the
   * members-only section. Three separated places, one run — so the run is
   * owned by the only component that contains all three.
   *
   * Called unconditionally, because hooks are. `aiOffered` decides whether
   * anything is *rendered*, which is the honest shape of "this deployment
   * has no gateway credentials": nothing on screen, nothing asked for, and
   * no branch in the middle of a hook list.
   */
  const suggesting = useSuggestion(photo.id, retireMessage);

  /*
   * Accepting a coordinate opens the section it lands in.
   *
   * A pin applied behind a closed disclosure is a change nobody consented
   * to seeing, which is the whole difference between this and a feature that
   * fills a field. The same argument the refused-save handler below makes
   * about the cursor: something that happens where it cannot be seen has not
   * happened to the person.
   */
  const takePoint = useCallback(
    (place: PlaceGuess) => {
      setMembersOpen(true);
      suggesting.takePoint(place);
    },
    [suggesting],
  );

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
    /*
     * The members-only section opens first when the refusal is in it.
     * `focus()` on a control inside a closed `<details>` puts the cursor
     * somewhere nobody can see, which is worse than not moving it at all.
     */
    if (state.field === "pin") {
      setMembersOpen(true);
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

      <PublicFields
        /*
          Not gated on `aiOffered`, unlike the button. With no gateway
          credentials nothing is ever asked for, so there are never any
          places and this renders nothing on its own — a second guard here
          would be a condition that can only agree with the first.
        */
        choices={
          <PlaceChoices
            answered={suggesting.answered}
            onName={suggesting.takeName}
            onPoint={takePoint}
            photoId={photo.id}
            places={suggesting.places}
          />
        }
        marks={marks}
        photo={photo}
        subjects={
          <TagChoices
            chosen={tags}
            onToggle={toggleTag}
            photoId={photo.id}
            suggested={suggesting.tags}
          />
        }
        suggest={aiOffered ? <SuggestDetails suggesting={suggesting} /> : null}
      />

      <MemberFields
        mapStyleUrl={mapStyleUrl}
        marks={marks}
        onToggle={toggleMembers}
        open={membersOpen}
        photo={photo}
        proposed={suggesting.proposed}
      />

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
