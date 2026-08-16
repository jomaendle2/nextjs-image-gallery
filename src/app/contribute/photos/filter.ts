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
    (photo.title ?? "").toLowerCase().includes(needle) ||
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
