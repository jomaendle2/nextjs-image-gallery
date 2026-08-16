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
      bg_color: bgColor,
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
