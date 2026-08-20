"use server";

import { del } from "@vercel/blob";
import { type FormState, failed, formText, succeeded } from "@/app/form-state";
import { requireContributor } from "@/lib/auth/session";
import { MAX_DESCRIPTION, MAX_TECHNIQUE, MAX_TITLE } from "@/lib/photos/caps";
import {
  deletePhoto,
  listOwnPhotos,
  publishPhoto,
  setPublished,
} from "@/lib/photos/repository";
import { revalidateFeeds } from "@/lib/photos/revalidate";
import { readPhotoTags } from "@/lib/photos/tags";
import type { OwnPhotoRow, PublishInput } from "@/lib/photos/types";

/**
 * Which field a refusal is about.
 *
 * The names are the `name` attributes the form submits, so the browser side
 * can mark the offending input without a translation table between the two
 * halves — a lookup that would be one more thing to keep in step, and the
 * kind that fails silently by marking nothing.
 */
export type PhotoField = "title" | "description" | "bg_color" | "pin";

/**
 * One shape for every form on the site, plus the field the message is about.
 *
 * `FormState` carries a message and a tone, which is everything a form with
 * one field needs. This form has eight, and a sentence in a live region after
 * the submit button told somebody *that* a title was required without telling
 * any assistive technology *which* control was wrong — WCAG 3.3.1 wants both.
 * So the field travels with the message, and `PhotoEditForm` spends it on
 * `aria-invalid`, `aria-describedby` and a focus move.
 *
 * Optional, because most of these messages are not about a field: "Published."
 * and "That photograph could not be found." belong to the form as a whole.
 */
export interface PhotoFormState extends FormState {
  field?: PhotoField;
}

/** A refusal that knows which control caused it. See `PhotoField`. */
function invalid(field: PhotoField, message: string): PhotoFormState {
  return { ...failed(message), field };
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;

/**
 * One half of a coordinate: a number, `null` for absent, `NaN` for wrong.
 *
 * Beside `formText` and following the `HEX_COLOR` precedent above. The range
 * check lives here rather than in a `CHECK` constraint because Postgres has
 * no `ADD CONSTRAINT IF NOT EXISTS`, and because somebody who typed 471.3
 * should read a sentence rather than meet a 500.
 *
 * Three outcomes rather than two, because collapsing "absent" and "wrong"
 * into one would tell a photographer who mistyped a longitude that their
 * latitude was missing.
 *
 * **`null`, never falsy.** `lat === 0` is a real coordinate — the Gulf of
 * Guinea is open sea off Ghana, and somebody will eventually photograph it —
 * so every check on this result has to be `=== null`. A truthiness test
 * would silently discard the equator and the prime meridian, for exactly the
 * photographs nobody thinks to test with.
 */
function coordinate(
  formData: FormData,
  key: string,
  limit: number,
): number | null {
  const raw = formData.get(key);
  if (typeof raw !== "string" || raw.trim() === "") {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) && Math.abs(value) <= limit
    ? value
    : Number.NaN;
}

/**
 * The pin the picker submitted, or the sentence to show instead.
 *
 * The picker parses whatever a person typed into two numbers and sends
 * those, so this validates a coordinate rather than re-implementing the
 * parser on the far side of the wire — two parsers for one field is how the
 * browser and the server end up disagreeing about what counts.
 *
 * `=== null` throughout, never falsy. Zero is a coordinate; a truthiness
 * check here would drop the equator and the prime meridian, silently, for
 * exactly the photographs nobody thinks to test with.
 */
function readPin(
  formData: FormData,
): { pin: PublishInput["pin"] } | { problem: string } {
  const lat = coordinate(formData, "precise_lat", MAX_LATITUDE);
  const lng = coordinate(formData, "precise_lng", MAX_LONGITUDE);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return {
      problem:
        "A latitude runs from -90 to 90, and a longitude from -180 to 180.",
    };
  }
  if ((lat === null) !== (lng === null)) {
    return { problem: "A location needs both a latitude and a longitude." };
  }
  if (lat === null || lng === null) {
    // Cleared. `publishPhoto` writes four NULLs, so the dot really goes.
    return { pin: null };
  }
  return {
    pin: {
      point: { lat, lng },
      /*
       * The photographer keeping the globe and giving up the exact point.
       * An unchecked box sends no field at all, hence a presence test.
       */
      publicOnly: formData.get("pin_public_only") !== null,
    },
  };
}

/**
 * The two fields a photograph cannot be published without, and why.
 *
 * Both are required, and the reason is not administrative: the description is
 * what `photoAltText` reads out in place of the photograph, so a published row
 * without one hands somebody who cannot see it the literal string
 * "Photograph". Saying which of the two is missing, and what it is for, is the
 * difference between a rule and an obstacle.
 *
 * `null` when there is nothing to say, so the caller reads one branch rather
 * than three. The combined sentence is kept for the case it was written for —
 * a photographer pressing Publish on a freshly uploaded row, where both are
 * empty and telling them about one is telling them half the news.
 */
function whatIsMissing(
  title: string,
  description: string,
): PhotoFormState | null {
  if (title === "" && description === "") {
    return invalid(
      "title",
      "A title and a description are both required. The description is what " +
        "a screen reader says in place of the photograph.",
    );
  }
  if (title === "") {
    return invalid("title", "A title is required — it names the photograph.");
  }
  if (description === "") {
    return invalid(
      "description",
      "A description is required. It is what a screen reader says in place " +
        "of the photograph, so without it there is nothing to say.",
    );
  }
  return null;
}

export async function savePhoto(
  _previous: PhotoFormState,
  formData: FormData,
): Promise<PhotoFormState> {
  const actor = await requireContributor();

  const id = formData.get("id");
  if (typeof id !== "string" || id === "") {
    return failed("Missing photograph.");
  }

  const title = formText(formData, "title", MAX_TITLE);
  const description = formText(formData, "description", MAX_DESCRIPTION);
  const missing = whatIsMissing(title, description);
  if (missing !== null) {
    return missing;
  }

  const bgColor = formText(formData, "bg_color", 7);
  if (!HEX_COLOR.test(bgColor)) {
    return invalid("bg_color", "The background colour must be a hex value.");
  }

  const location = formText(formData, "location", MAX_TITLE);

  /*
   * The two member-only fields. Optional, and empty for most photographs —
   * a photographer says where they stood only when they want to.
   */
  const preciseLocation = formText(formData, "precise_location", MAX_TITLE);
  const technique = formText(formData, "technique", MAX_TECHNIQUE);

  const marked = readPin(formData);
  if ("problem" in marked) {
    return invalid("pin", marked.problem);
  }

  /*
   * An unchecked box sends no field at all, which is why this is a presence
   * test rather than a comparison against "on" or "true".
   */
  const isSpecimen = formData.get("is_specimen") !== null;

  /*
   * The subjects, read as the whole set the form is holding.
   *
   * `getAll` rather than `get`, because the chips render one hidden input
   * per chosen tag — so a photograph with no tags sends the field zero
   * times, which is the same absence as a photograph whose tags were all
   * removed. That is correct here: both mean "no subjects", and the column
   * is written either way.
   *
   * Not refused when it contains something unrecognised, just filtered.
   * Nothing a photographer can do in the form produces an off-list tag —
   * they pick from chips built out of the same list — so a stray value is a
   * hand-built request, and answering it with a sentence about a control
   * that does not exist would help nobody.
   */
  const tags = readPhotoTags(formData.getAll("tags"));

  /*
   * Which button was pressed. Saving and publishing are separate actions on
   * one form, so a photographer can write a title without the photograph
   * going live — and the message afterwards says which of the two happened
   * rather than always claiming "Published."
   */
  const publish = formData.get("intent") === "publish";

  // publishPhoto scopes the UPDATE to the actor unless they are the owner,
  // so a forged id changes nothing and returns null.
  const saved = await publishPhoto(
    id,
    {
      title,
      description,
      location: location === "" ? null : location,
      precise_location: preciseLocation === "" ? null : preciseLocation,
      technique: technique === "" ? null : technique,
      /*
       * Offering a photograph as the public example only means something if
       * there is something to show, so an empty pair cannot be offered — the
       * membership page would render a frame with two blanks in it.
       */
      is_specimen: isSpecimen && (preciseLocation !== "" || technique !== ""),
      bg_color: bgColor,
      /*
       * One point in, two stored. `publishPhoto` runs it through `coarsen()`
       * itself, so a caller cannot submit an exact point in the Alps with a
       * public dot in the Atlantic — and clearing the field writes four
       * NULLs rather than leaving the old dot on the globe.
       */
      pin: marked.pin,
      tags,
    },
    actor,
    publish,
  );

  if (saved === null) {
    return failed("That photograph could not be found.");
  }

  revalidateFeeds(saved.slug);
  if (publish) {
    /*
     * Short, because the form puts a link to the live photograph beside it.
     * "Published." on its own was the end of the road: the one thing somebody
     * wants after publishing is to look at the thing they published, and
     * there was nowhere on this page to do that.
     */
    return succeeded("Published.");
  }
  return succeeded(
    saved.live ? "Changes saved." : "Draft saved. Not published yet.",
  );
}

export async function togglePublished(
  id: string,
  published: boolean,
): Promise<void> {
  const actor = await requireContributor();
  const slug = await setPublished(id, published, actor);
  if (slug !== null) {
    revalidateFeeds(slug);
  }
}

/**
 * Deletes storage that no row points at any more, after the rows are gone.
 *
 * Both blobs per photograph, not one. An upload writes the original and a
 * re-encoded display copy; deleting only the original left multiple megabytes
 * behind with no row pointing at them, which meant nothing could ever find
 * them again to clean up.
 *
 * Failures are logged rather than surfaced, and the whole thing runs after
 * the rows are deleted: the photograph is already off the site, which is what
 * was asked for, and an orphaned blob is a storage bill rather than a broken
 * page.
 *
 * Not `"use server"`-exported, so it stays a plain helper — both delete
 * actions had written this same `Promise.all` out, which is one place too
 * many for a rule about which failures are allowed to be silent.
 */
async function deleteBlobs(paths: readonly string[]): Promise<void> {
  await Promise.all(
    paths.map((target) =>
      del(target).catch((error: unknown) => {
        console.error(`Could not delete the blob ${target}:`, error);
      }),
    ),
  );
}

export async function removePhoto(id: string): Promise<void> {
  const actor = await requireContributor();
  const deleted = await deletePhoto(id, actor);
  if (deleted === null) {
    return;
  }

  await deleteBlobs(
    [deleted.blob_pathname, deleted.display_pathname].filter(
      (target): target is string => target !== null,
    ),
  );

  /*
   * The author's page, not the actor's. The owner may delete anybody's
   * photograph, and revalidating their own page left the deleted work
   * showing on the real author's page and in their feed for an hour.
   */
  revalidateFeeds(deleted.author_slug);
}

/** The rule `whatIsMissing` enforces one photograph at a time. */
function isPublishable(photo: OwnPhotoRow): boolean {
  return photo.title.trim() !== "" && photo.description.trim() !== "";
}

/**
 * Which of the actor's own photographs may go live.
 *
 * A set of ids rather than a per-id check, because this is one query for a
 * selection of any size. `listOwnPhotos` is the same read the dashboard did to
 * draw the rows being ticked, so the answer is the one the photographer is
 * looking at — and it is scoped to `actor.id`, so an id belonging to somebody
 * else is simply absent from the set and refused, exactly as `setPublished`
 * would have refused it.
 *
 * Read on the server rather than trusting the selection, even though the
 * browser has the same two fields in hand. The point is not that the client
 * would lie; it is that "a published photograph has a description" is a rule
 * about the gallery, and a rule enforced only where it is convenient is a rule
 * with one path around it.
 */
async function publishableIds(actorId: string): Promise<ReadonlySet<string>> {
  const own = await listOwnPhotos(actorId);
  return new Set(own.filter(isPublishable).map((photo) => photo.id));
}

/**
 * Publishes or unpublishes several photographs at once.
 *
 * The workflow this exists for is real and was genuinely tedious: upload
 * ten photographs, then publish ten photographs, which meant ten expand-
 * click-collapse cycles down a list. Anything a person does ten times in a
 * row is a thing the interface should let them do once.
 *
 * Publishing only. Deleting is `bulkRemovePhotos` below, which needs its own
 * confirmation because it cannot be undone — publishing something by mistake
 * costs a second click to reverse, and deleting costs the photograph.
 *
 * Authorisation is unchanged and per-row: `setPublished` carries
 * `AND author_id = ...` for a contributor, so a forged id in this list
 * updates nothing rather than somebody else's photograph. The loop is
 * sequential because these are small writes and a partial failure should
 * stop rather than race.
 *
 * **Publishing here refuses what publishing one at a time refuses.** It did
 * not, and that was the sharpest hole on this page: `savePhoto` will not put a
 * photograph live without a title and a description, while "select all →
 * Publish" walked straight past both checks. An untitled row published this
 * way reaches the gallery, the globe, the RSS feed and the next subscriber
 * announcement, where `photoAltText` has nothing to work with and degrades to
 * the literal string "Photograph" — so the one route that skipped the rule was
 * also the one that could break a dozen rows in a single click.
 *
 * Rows that do not qualify are left alone and counted, rather than failing the
 * batch: publishing nine because the tenth has no caption would be a worse
 * answer than publishing nine and saying so. `refused` is what the list turns
 * into a sentence naming what is still needed.
 */
export async function bulkSetPublished(
  ids: readonly string[],
  published: boolean,
): Promise<{ changed: number; refused: number }> {
  const actor = await requireContributor();

  /*
   * Only when publishing. Unpublishing an untitled photograph is the fix for
   * having published one, so a check there would trap the row on the site.
   */
  const allowed = published ? await publishableIds(actor.id) : null;

  const slugs = new Set<string>();
  let changed = 0;
  let refused = 0;
  for (const id of ids) {
    if (allowed !== null && !allowed.has(id)) {
      refused += 1;
    } else {
      // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — small writes, and a partial failure should stop rather than race the rest
      const slug = await setPublished(id, published, actor);
      if (slug !== null) {
        slugs.add(slug);
        changed += 1;
      }
    }
  }

  // One revalidation per affected photographer, not one per photograph.
  for (const slug of slugs) {
    revalidateFeeds(slug);
  }
  return { changed, refused };
}

/**
 * Deletes several photographs, having been told exactly which.
 *
 * The confirmation lists the titles rather than a count: a number cannot be
 * checked against intent, but a misclicked row shows up as a name the person
 * did not mean to see. That is what makes offering this safe.
 *
 * Authorisation is per row, exactly as in `bulkSetPublished`: `deletePhoto`
 * carries `AND author_id = ...` for a contributor, so a forged id in this
 * list deletes nothing rather than somebody else's work.
 */
export async function bulkRemovePhotos(
  ids: readonly string[],
): Promise<{ deleted: number }> {
  const actor = await requireContributor();

  const slugs = new Set<string>();
  const blobs: string[] = [];
  let deleted = 0;

  for (const id of ids) {
    // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — a partial failure should stop rather than race the rest
    const row = await deletePhoto(id, actor);
    if (row !== null) {
      slugs.add(row.author_slug);
      blobs.push(row.blob_pathname);
      if (row.display_pathname !== null) {
        blobs.push(row.display_pathname);
      }
      deleted += 1;
    }
  }

  await deleteBlobs(blobs);

  for (const slug of slugs) {
    revalidateFeeds(slug);
  }
  return { deleted };
}
