/**
 * What one drop of files looks like while it is going up.
 *
 * Its own module rather than the top of `UploadForm.tsx`, because the list that
 * renders these lives in `UploadList.tsx` and a component importing its types
 * back out of the component that renders it is an import cycle. Types and the
 * one function over them, and nothing that renders.
 */

export type ItemStatus = "waiting" | "uploading" | "done" | "failed";

export interface Item {
  /**
   * Stable across re-renders and unique within a batch. Two files really can
   * share a name — `DSC0100.jpg` from two cards — so the name alone is not a
   * key, and the array index changes meaning if the list is ever filtered.
   */
  id: string;
  name: string;
  /**
   * The handle itself, kept so a failure can be tried again.
   *
   * A failed file used to be unrecoverable in the most annoying possible way:
   * the `File` was still in memory, the browser could still have read it, and
   * the only offered way forward was to open the file dialog and find it again
   * among two hundred others. Ten files, one flaky moment, and the batch is
   * half done with no way to finish it.
   */
  file: File;
  status: ItemStatus;
  error?: string;
}

/** One file and where it sits in the batch, which is what `setStatus` needs. */
export interface Attempt {
  file: File;
  index: number;
}

/** Distinguishes same-named files within one batch. */
export function itemId(file: File, index: number): string {
  return `${index}-${file.name}-${file.size}`;
}

/**
 * The files that failed, and the list with them queued to go again.
 *
 * One pass and one pure function, because the two answers have to agree: the
 * indices handed to the uploader are positions in the list this returns, and
 * computing them separately is how a retry ends up reporting its progress
 * against the wrong rows.
 *
 * Positions in the existing list rather than a fresh batch, so the rows stay
 * where they are and a retry is visibly the same ten files with three of them
 * moving — not a shorter list, which reads as having lost the seven that
 * worked.
 */
export function retryBatch(items: readonly Item[]): {
  again: Attempt[];
  items: Item[];
} {
  const again: Attempt[] = [];
  const next = items.map((item, index) => {
    if (item.status !== "failed") {
      return item;
    }
    again.push({ file: item.file, index });
    /*
     * The key is dropped rather than set to `undefined`. `error` is optional
     * because a waiting item has never had one, and under
     * `exactOptionalPropertyTypes` those are two different states — an
     * explicit `undefined` is a value, and this is the absence of one.
     */
    const { error: _cleared, ...rest } = item;
    return { ...rest, status: "waiting" as const };
  });
  return { again, items: next };
}

/**
 * One sentence about the batch, or silence.
 *
 * Silence is most of the time, and that is the point: this is the text of a
 * live region, so anything it returns is spoken over whatever the person was
 * reading. It changes only when a file reaches a terminal state — never while
 * a percentage ticks — and it stops once the batch is over, because the closing
 * `Notice` announces itself and two voices saying the same news is worse than
 * one saying it late.
 */
export function announce(items: readonly Item[], busy: boolean): string {
  const failed = items.filter((item) => item.status === "failed").length;
  const settled =
    items.filter((item) => item.status === "done").length + failed;
  if (!busy || settled === 0) {
    return "";
  }
  const added = `${settled - failed} of ${items.length} added`;
  return failed === 0 ? added : `${added}, ${failed} could not be used`;
}
