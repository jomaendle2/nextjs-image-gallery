"use client";

import { AlertCircle, Check, RotateCcw } from "lucide-react";
import { GlassButton } from "@/components/ui/glass-button";
import { Notice } from "@/components/ui/Notice";
import { count } from "@/lib/plural";
import type { Item } from "./upload-batch";

const PERCENT = 100;

/**
 * How one file is doing.
 *
 * A failure must not render in the same grey as a success. After dropping
 * ten files, seeing at a glance which did not make it is the whole reason to
 * show a list at all.
 */
function Status({
  item,
  percent,
}: {
  item: { status: string; error?: string | null };
  percent: number;
}) {
  if (item.status === "uploading") {
    return <span className="flex-shrink-0 text-white/55">{percent}%</span>;
  }
  if (item.status === "waiting") {
    return <span className="flex-shrink-0 text-white/55">waiting</span>;
  }
  if (item.status === "done") {
    return (
      <span className="flex flex-shrink-0 items-center gap-1.5 text-positive">
        <Check aria-hidden="true" size={14} />
        added
      </span>
    );
  }
  return (
    <span className="flex flex-shrink-0 items-center gap-1.5 text-danger">
      <AlertCircle aria-hidden="true" size={14} />
      {item.error ?? "failed"}
    </span>
  );
}

/**
 * The batch, as a list, a bar, and one sentence for a screen reader.
 *
 * Split from `UploadForm` when that file passed three hundred lines: this half
 * only reads, so everything it needs arrives as a prop and nothing here decides
 * anything.
 *
 * **The announcement is not the list.** `aria-live` used to sit on the `<ul>`
 * while the percentage inside it ticked, so a ten-file batch re-read every
 * filename on every percent — a thousand announcements, over a progress bar
 * that was already reporting itself through `role="progressbar"`. The sentence
 * below changes only when a file reaches a terminal state, and it lives in its
 * own region so the filenames can update without saying anything.
 *
 * That region is always in the DOM, even empty. A live region that appears at
 * the same moment as its first content is a live region a screen reader was not
 * yet watching, which is to say no live region at all.
 */
export function UploadList({
  items,
  percent,
  busy,
  announcement,
}: {
  items: Item[];
  percent: number;
  busy: boolean;
  /** One sentence, or "" for silence. See the note above. */
  announcement: string;
}) {
  return (
    <>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {items.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li
              className="flex items-center justify-between gap-3 text-sm"
              key={item.id}
            >
              <span className="min-w-0 flex-1 truncate text-white/70">
                {item.name}
              </span>
              <Status item={item} percent={percent} />
            </li>
          ))}
        </ul>
      ) : null}

      {busy ? (
        <div className="mt-4">
          <div
            aria-label="Upload progress"
            aria-valuemax={PERCENT}
            aria-valuemin={0}
            aria-valuenow={percent}
            className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
            role="progressbar"
          >
            <div
              className="h-full rounded-full bg-white/70 transition-[width] duration-200"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

/**
 * How the batch ended, and the way out of a batch that ended badly.
 *
 * The retry is offered before "Done", because a batch with a hole in it is not
 * done — and it is one click rather than another trip through the file dialog,
 * since the `File` handles never left memory. Naming the count in the button
 * means the person can tell what pressing it will do without counting the red
 * lines above it themselves.
 */
export function BatchSummary({
  added,
  failed,
  onRetry,
  onDismiss,
}: {
  added: number;
  failed: number;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  return (
    <Notice className="mt-4" tone={failed > 0 ? "error" : "success"}>
      <div className="flex flex-wrap items-center gap-3">
        <span>
          {failed === 0
            ? "All added. Give them titles below."
            : `${added} added, ${failed} could not be used.`}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          {failed === 0 ? null : (
            <GlassButton onClick={onRetry} size="sm">
              <RotateCcw aria-hidden="true" className="mr-1.5" size={14} />
              Try {count(failed, "file")} again
            </GlassButton>
          )}
          <GlassButton onClick={onDismiss} size="sm">
            Done
          </GlassButton>
        </div>
      </div>
    </Notice>
  );
}
