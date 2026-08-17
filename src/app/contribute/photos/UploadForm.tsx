"use client";

import { upload } from "@vercel/blob/client";
import { AlertCircle, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type DragEvent,
  useCallback,
  useRef,
  useState,
} from "react";
import { SECTION_HEADING } from "@/components/ui/field";
import { GlassButton } from "@/components/ui/glass-button";
import { Notice } from "@/components/ui/Notice";

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
const ACCEPTED_TYPES = new Set(ACCEPT.split(","));
const MAX_BYTES = 25 * 1024 * 1024;
const PERCENT = 100;

type ItemStatus = "waiting" | "uploading" | "done" | "failed";

interface Item {
  /**
   * Stable across re-renders and unique within a batch. Two files really can
   * share a name — `DSC0100.jpg` from two cards — so the name alone is not a
   * key, and the array index changes meaning if the list is ever filtered.
   */
  id: string;
  name: string;
  status: ItemStatus;
  error?: string;
}

/** Distinguishes same-named files within one batch. */
function itemId(file: File, index: number): string {
  return `${index}-${file.name}-${file.size}`;
}

/**
 * How one file is doing.
 *
 * A failure must not render in the same grey as a success. After dropping
 * ten files, seeing at a glance which did not make it is the whole reason to
 * show a list at all.
 *
 * Its own component because the parent was already at the edge of the
 * complexity limit, and three branches of colour plus three of content is
 * exactly the kind of thing that pushes a render function over.
 */
function ItemStatus({
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
 * Uploads straight from the browser to Blob, then asks the server to read the
 * file back and derive its metadata.
 *
 * Two things here are load-bearing. `multipart` because a single PUT of a
 * 20 MB original that fails at 90% starts over. And the files go up one
 * after another rather than in parallel: twenty megabytes each at once
 * saturates the connection, makes every progress bar meaningless, and loses
 * the whole batch to one flaky moment.
 */
export function UploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [percent, setPercent] = useState(0);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  // Depth rather than a boolean: dragging across a child element fires
  // `dragleave` on the parent, so a boolean flickers the highlight off as
  // the pointer crosses the text inside the zone.
  const dragDepth = useRef(0);

  const busy = items.some(
    (item) => item.status === "waiting" || item.status === "uploading",
  );

  const setStatus = useCallback(
    (index: number, status: ItemStatus, error?: string) => {
      setItems((previous) =>
        previous.map((item, i) =>
          i === index ? { ...item, status, error } : item,
        ),
      );
    },
    [],
  );

  const uploadOne = useCallback(async (file: File) => {
    /*
     * The storage client's own failures are not the photographer's language.
     * It throws things like "Vercel Blob: Access denied" and bare network
     * errors, and the catch downstream shows `error.message` verbatim beside
     * their filename — naming infrastructure they have no relationship with
     * and cannot act on. The same rule the draft route now follows: log the
     * real thing, show a sentence.
     *
     * The draft response's message passes through untouched, because that
     * one is already written for a person on the server.
     */
    let blob: Awaited<ReturnType<typeof upload>>;
    try {
      blob = await upload(`photos/${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/uploads/token",
        multipart: true,
        onUploadProgress: ({ percentage }) => {
          setPercent(Math.round(percentage));
        },
      });
    } catch (cause) {
      console.error("Blob upload failed:", cause);
      throw new Error("Could not be sent — check your connection and retry.", {
        cause,
      });
    }

    const response = await fetch("/api/photos/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blobUrl: blob.url }),
    });

    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      throw new Error(body.error ?? "That upload could not be read.");
    }
  }, []);

  /** One file, start to finish. Never throws; reports through `setStatus`. */
  const runOne = useCallback(
    async (file: File, index: number) => {
      if (file.size > MAX_BYTES) {
        setStatus(index, "failed", "Larger than 25 MB.");
        return;
      }

      setStatus(index, "uploading");
      setPercent(0);
      try {
        await uploadOne(file);
        setStatus(index, "done");
      } catch (error) {
        setStatus(
          index,
          "failed",
          error instanceof Error ? error.message : "The upload failed.",
        );
      }
    },
    [setStatus, uploadOne],
  );

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) {
        return;
      }

      setItems(
        files.map((file, index) => ({
          id: itemId(file, index),
          name: file.name,
          status: "waiting",
        })),
      );

      for (const [index, file] of files.entries()) {
        // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — see the note on the component
        await runOne(file, index);
      }

      if (inputRef.current) {
        inputRef.current.value = "";
      }
      // One refresh for the batch. Refreshing per file re-renders the whole
      // list under the upload that is still running.
      router.refresh();
    },
    [router, runOne],
  );

  const start = useCallback(
    (files: File[]) => {
      handleFiles(files).catch((error: unknown) => {
        console.error("Upload failed:", error);
      });
    },
    [handleFiles],
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      start([...(event.target.files ?? [])]);
    },
    [start],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragDepth.current = 0;
      setIsDraggingOver(false);
      if (busy) {
        return;
      }
      /*
       * Filtered by type here as well as by the input's `accept`, because a
       * drop bypasses the file picker entirely — without this, dragging a
       * folder of RAWs in would start twenty uploads the server will refuse.
       */
      start(
        [...event.dataTransfer.files].filter((file) =>
          ACCEPTED_TYPES.has(file.type),
        ),
      );
    },
    [busy, start],
  );

  const handleDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current += 1;
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setIsDraggingOver(false);
    }
  }, []);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    // Without this the browser navigates to the dropped file.
    event.preventDefault();
  }, []);

  const dismiss = useCallback(() => {
    setItems([]);
  }, []);

  const failures = items.filter((item) => item.status === "failed");
  const finished = items.length > 0 && !busy;

  return (
    /*
     * The drop target is a plain container with a real file input inside it,
     * not a click-to-open div. Dragging is the shortcut; the input is the
     * interaction that works with a keyboard, a screen reader and a phone.
     */
    // biome-ignore lint/a11y/noStaticElementInteractions: drag affordance over a real file input
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: drag affordance over a real file input
    <div
      className={`rounded-3xl border p-6 transition-colors duration-200 ${
        isDraggingOver
          ? "border-white/40 bg-white/[0.08]"
          : "border-white/12 bg-white/5"
      }`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <h2 className={SECTION_HEADING}>Add photographs</h2>
      <p className="mt-1 mb-4 text-sm text-white/55">
        Drag them here, or choose them below. JPEG, PNG, WebP or AVIF, up to 25
        MB each. Upload the full-size originals — they are stored exactly as you
        sent them. Camera and exposure details are read from the file; the GPS
        block is never read, and the copy the gallery publishes carries no
        metadata at all. Where a photograph was taken is only ever something you
        add afterwards, on the photograph itself.
      </p>

      <input
        accept={ACCEPT}
        aria-label="Choose photographs to upload"
        className="block w-full text-sm text-white/70 file:mr-4 file:min-h-11 file:cursor-pointer file:rounded-full file:border-0 file:bg-white/10 file:px-5 file:font-medium file:text-sm file:text-white hover:file:bg-white/20"
        disabled={busy}
        multiple={true}
        onChange={handleChange}
        ref={inputRef}
        type="file"
      />

      {items.length > 0 ? (
        <ul className="mt-4 space-y-2" aria-live="polite">
          {items.map((item) => (
            <li
              className="flex items-center justify-between gap-3 text-sm"
              key={item.id}
            >
              <span className="min-w-0 flex-1 truncate text-white/70">
                {item.name}
              </span>
              <ItemStatus item={item} percent={percent} />
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

      {finished ? (
        <Notice
          className="mt-4"
          tone={failures.length > 0 ? "error" : "success"}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span>
              {failures.length === 0
                ? "All added. Give them titles below."
                : `${items.length - failures.length} added, ${failures.length} could not be used.`}
            </span>
            <GlassButton className="ml-auto" onClick={dismiss} size="sm">
              Done
            </GlassButton>
          </div>
        </Notice>
      ) : null}
    </div>
  );
}
