import type { OwnPhotoRow } from "@/lib/photos/types";

/** The three states of the status filter. */
export type PhotoFilter = "all" | "published" | "draft";

export const FILTERS: { value: PhotoFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Drafts" },
];

/**
 * Does this row match what was typed?
 *
 * Title and location only. Description is deliberately excluded: it is long,
 * so searching it returns rows whose match is invisible in the collapsed
 * summary — the person sees a result and cannot tell why.
 *
 * `needle` is expected already trimmed and lowercased, once, by the caller;
 * doing it here would redo it per row on every keystroke.
 */
export function matches(photo: OwnPhotoRow, needle: string): boolean {
  if (needle === "") {
    return true;
  }
  return (
    photo.title.toLowerCase().includes(needle) ||
    (photo.location ?? "").toLowerCase().includes(needle)
  );
}

/** Applies the status filter and the search box together. */
export function selectPhotos(
  photos: OwnPhotoRow[],
  filter: PhotoFilter,
  query: string,
): OwnPhotoRow[] {
  const needle = query.trim().toLowerCase();
  return photos.filter((photo) => {
    if (filter === "published" && photo.published_at === null) {
      return false;
    }
    if (filter === "draft" && photo.published_at !== null) {
      return false;
    }
    return matches(photo, needle);
  });
}

/** The number beside each filter label. */
export function countByStatus(
  photos: OwnPhotoRow[],
): Record<PhotoFilter, number> {
  const published = photos.filter((p) => p.published_at !== null).length;
  return {
    all: photos.length,
    published,
    draft: photos.length - published,
  };
}

/**
 * Ticking or clearing everything the filter currently matches.
 *
 * The set this acts on is the *filtered* one, not the rendered one. Those
 * differ whenever the row cap is in play, and picking the wrong one is the
 * classic version of this bug: a control labelled "select all" that quietly
 * means "select the thirty you can see", so a bulk delete leaves a tail the
 * person believed they had removed. The count in the label comes from the
 * same array as the selection for exactly that reason.
 *
 * Rows matched by a *different* filter keep whatever state they had. Someone
 * who selects three drafts, switches to published and clears has not
 * silently lost their three.
 */
export function toggleAll(
  selected: ReadonlySet<string>,
  visible: OwnPhotoRow[],
): Set<string> {
  const next = new Set(selected);
  const allChosen =
    visible.length > 0 && visible.every((photo) => selected.has(photo.id));

  for (const photo of visible) {
    if (allChosen) {
      next.delete(photo.id);
    } else {
      next.add(photo.id);
    }
  }
  return next;
}

/** Whether the filtered rows are all, partly, or not selected. */
export function selectionState(
  selected: ReadonlySet<string>,
  visible: OwnPhotoRow[],
): "none" | "some" | "all" {
  if (visible.length === 0) {
    return "none";
  }
  const chosen = visible.filter((photo) => selected.has(photo.id)).length;
  if (chosen === 0) {
    return "none";
  }
  return chosen === visible.length ? "all" : "some";
}
