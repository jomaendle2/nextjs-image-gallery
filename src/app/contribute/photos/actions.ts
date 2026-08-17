"use server";

import { del } from "@vercel/blob";
import { type FormState, failed, succeeded } from "@/app/form-state";
import { requireContributor } from "@/lib/auth/session";
import {
  deletePhoto,
  publishPhoto,
  setPublished,
} from "@/lib/photos/repository";
import { revalidateFeeds } from "@/lib/photos/revalidate";
import type { PublishInput } from "@/lib/photos/types";

/** One shape for every form on the site. See `@/app/form-state`. */
export type PhotoFormState = FormState;

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 300;
/* Room for a paragraph about how a photograph was made, not an essay. */
const MAX_TECHNIQUE = 600;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function text(formData: FormData, key: string, max: number): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;

/**
 * One half of a coordinate: a number, `null` for absent, `NaN` for wrong.
 *
 * Beside `text` and following the `HEX_COLOR` precedent above. The range
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

export async function savePhoto(
  _previous: PhotoFormState,
  formData: FormData,
): Promise<PhotoFormState> {
  const actor = await requireContributor();

  const id = formData.get("id");
  if (typeof id !== "string" || id === "") {
    return failed("Missing photograph.");
  }

  const title = text(formData, "title", MAX_TITLE);
  const description = text(formData, "description", MAX_DESCRIPTION);
  if (title === "" || description === "") {
    return failed("A title and a description are both required.");
  }

  const bgColor = text(formData, "bg_color", 7);
  if (!HEX_COLOR.test(bgColor)) {
    return failed("The background colour must be a hex value.");
  }

  const location = text(formData, "location", MAX_TITLE);

  /*
   * The two member-only fields. Optional, and empty for most photographs —
   * a photographer says where they stood only when they want to.
   */
  const preciseLocation = text(formData, "precise_location", MAX_TITLE);
  const technique = text(formData, "technique", MAX_TECHNIQUE);

  const marked = readPin(formData);
  if ("problem" in marked) {
    return failed(marked.problem);
  }

  /*
   * An unchecked box sends no field at all, which is why this is a presence
   * test rather than a comparison against "on" or "true".
   */
  const isSpecimen = formData.get("is_specimen") !== null;

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
    },
    actor,
    publish,
  );

  if (saved === null) {
    return failed("That photograph could not be found.");
  }

  revalidateFeeds(saved.slug);
  if (publish) {
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

export async function removePhoto(id: string): Promise<void> {
  const actor = await requireContributor();
  const deleted = await deletePhoto(id, actor);
  if (deleted === null) {
    return;
  }

  /*
   * Both blobs, not one. An upload writes the original and a re-encoded
   * display copy; deleting only the original left multiple megabytes behind
   * with no row pointing at them, which meant nothing could ever find them
   * again to clean up.
   *
   * The row is the source of truth, so a blob with no row is unreachable and
   * goes too. Failure is logged rather than surfaced — the photograph is
   * already off the site, which is what was asked for.
   */
  const blobs = [deleted.blob_pathname, deleted.display_pathname].filter(
    (target): target is string => target !== null,
  );
  await Promise.all(
    blobs.map((target) =>
      del(target).catch((error: unknown) => {
        console.error(`Could not delete the blob ${target}:`, error);
      }),
    ),
  );

  /*
   * The author's page, not the actor's. The owner may delete anybody's
   * photograph, and revalidating their own page left the deleted work
   * showing on the real author's page and in their feed for an hour.
   */
  revalidateFeeds(deleted.author_slug);
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
 */
export async function bulkSetPublished(
  ids: readonly string[],
  published: boolean,
): Promise<{ changed: number }> {
  const actor = await requireContributor();

  const slugs = new Set<string>();
  let changed = 0;
  for (const id of ids) {
    // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — small writes, and a partial failure should stop rather than race the rest
    const slug = await setPublished(id, published, actor);
    if (slug !== null) {
      slugs.add(slug);
      changed += 1;
    }
  }

  // One revalidation per affected photographer, not one per photograph.
  for (const slug of slugs) {
    revalidateFeeds(slug);
  }
  return { changed };
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

  /*
   * Blobs after the rows, and failures only logged. The photographs are
   * already gone from the site, which is what was asked for; an orphaned
   * blob is a storage bill rather than a broken page.
   */
  await Promise.all(
    blobs.map((target) =>
      del(target).catch((error: unknown) => {
        console.error(`Could not delete the blob ${target}:`, error);
      }),
    ),
  );

  for (const slug of slugs) {
    revalidateFeeds(slug);
  }
  return { deleted };
}
