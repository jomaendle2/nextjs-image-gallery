"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { SECTION_HEADING } from "@/components/ui/field";
import { Notice } from "@/components/ui/Notice";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/photos/caps";
import { BatchSummary, UploadList } from "./UploadList";
import {
  type Attempt,
  announce,
  type Item,
  type ItemStatus,
  itemId,
  retryBatch,
} from "./upload-batch";
import { useDropZone } from "./useDropZone";
import { Why } from "./Why";

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
const ACCEPTED_TYPES = new Set(ACCEPT.split(","));

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
/**
 * The panel's static top: heading, the two-sentence invitation, and the
 * folded reassurances. Module-level because none of it touches state — and
 * because the component below sits against the function-length limit, which
 * is a fair reading of what happened to it: markup that never changes was
 * crowding the half that does.
 */
function PanelIntro() {
  return (
    <>
      <h2 className={SECTION_HEADING}>Add photographs</h2>
      {/*
        Two sentences on screen; the reassurances fold. This paragraph ran to
        five sentences of privacy prose that every photographer re-read on
        every visit — the `Why` keeps all of it one click away, said once,
        which is the pattern the edit form already uses for exactly this kind
        of statement.
      */}
      <p className="mt-1 mb-3 text-sm text-white/55">
        Drag full-size originals here, or choose them below. JPEG, PNG, WebP or
        AVIF, up to {MAX_UPLOAD_MB} MB each.
      </p>
      <div className="mb-4">
        <Why summary="Your originals stay exactly as you sent them.">
          Camera and exposure details are read from the file; the GPS block is
          never read, and the copy the gallery publishes carries no metadata at
          all. Where a photograph was taken is only ever something you add
          afterwards, on the photograph itself.
        </Why>
      </div>
    </>
  );
}

/**
 * Land in the editor rather than beside it: the first new draft's id goes
 * into `?open=` and `PhotoList` opens that row, instead of the batch ending
 * on a refreshed list and a hunt for the row just made. The *first* of a
 * batch — the list is newest-first and editing proceeds downward.
 * `replace`, not `push`: Back should leave the page, not step through
 * upload states.
 */
function openFreshDraft(
  router: ReturnType<typeof useRouter>,
  id: string | null,
): void {
  if (id !== null) {
    router.replace(`/contribute/photos?open=${id}`, { scroll: false });
  }
  // One refresh for the batch; per-file refreshes re-render the list under
  // a running upload.
  router.refresh();
}

export function UploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [percent, setPercent] = useState(0);
  /**
   * The files we would not take, by name, so the refusal can be read.
   *
   * A photographer works in whatever their camera and phone produce, and
   * `.HEIC` off an iPhone and `.CR3`/`.NEF`/`.DNG` off a body are the obvious
   * things to drag in first. They were being discarded in silence.
   */
  const [skipped, setSkipped] = useState<string[]>([]);

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

    const created = (await response.json()) as { id?: string };
    return typeof created.id === "string" ? created.id : null;
  }, []);

  /** One file, start to finish. Never throws; reports through `setStatus`. */
  const runOne = useCallback(
    async (file: File, index: number) => {
      if (file.size > MAX_UPLOAD_BYTES) {
        setStatus(index, "failed", `Larger than ${MAX_UPLOAD_MB} MB.`);
        return;
      }

      setStatus(index, "uploading");
      setPercent(0);
      try {
        const id = await uploadOne(file);
        setStatus(index, "done");
        return id;
      } catch (error) {
        setStatus(
          index,
          "failed",
          error instanceof Error ? error.message : "The upload failed.",
        );
        return null;
      }
    },
    [setStatus, uploadOne],
  );

  /**
   * A run of files, one after another, whatever the reason for the run.
   *
   * Takes the attempts rather than reading state, so the first pass over a
   * fresh batch and a retry of the three that failed are the same code path
   * with a different list — which is what keeps a retry from drifting into a
   * second, subtly different uploader.
   */
  const runBatch = useCallback(
    async (batch: readonly Attempt[]) => {
      let firstCreated: string | null = null;
      for (const { file, index } of batch) {
        // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — see the note on the component
        const id = await runOne(file, index);
        firstCreated ??= id ?? null;
      }

      if (inputRef.current) {
        inputRef.current.value = "";
      }
      openFreshDraft(router, firstCreated);
    },
    [router, runOne],
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
          file,
          status: "waiting",
        })),
      );

      await runBatch(files.map((file, index) => ({ file, index })));
    },
    [runBatch],
  );

  /**
   * The one place a file is judged uploadable, for both doors.
   *
   * The drop zone hands over everything now, and the picker's `accept` is a
   * hint the operating system is free to ignore — so this runs on the way in
   * from either, and whatever it turns away is named rather than dropped on
   * the floor.
   */
  const start = useCallback(
    (files: File[]) => {
      const usable = files.filter((file) => ACCEPTED_TYPES.has(file.type));
      setSkipped(
        files
          .filter((file) => !ACCEPTED_TYPES.has(file.type))
          .map((f) => f.name),
      );

      if (usable.length === 0) {
        return;
      }

      handleFiles(usable).catch((error: unknown) => {
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

  const { isDraggingOver, handlers } = useDropZone({
    busy,
    onFiles: start,
  });

  const dismiss = useCallback(() => {
    setItems([]);
    setSkipped([]);
  }, []);

  const failures = items.filter((item) => item.status === "failed");
  const finished = items.length > 0 && !busy;

  /** The ones that did not make it, again. See `retryBatch`. */
  const retryFailed = useCallback(() => {
    const { again, items: requeued } = retryBatch(items);
    if (again.length === 0) {
      return;
    }
    setItems(requeued);
    runBatch(again).catch((error: unknown) => {
      console.error("Retry failed:", error);
    });
  }, [items, runBatch]);

  /*
   * Closing the tab mid-batch loses the rest of it.
   *
   * The files are held in this component's state and go up one at a time, so a
   * tab closed six files into ten does not resume anywhere — the remaining
   * four were never sent and the browser has no handle on them any more. The
   * browser's own dialog is the only thing that can interrupt that, and it is
   * only allowed while something is actually in flight, which is the whole
   * reason `busy` gates the listener rather than the handler.
   */
  useEffect(() => {
    if (!busy) {
      return;
    }
    const hold = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", hold);
    return () => {
      window.removeEventListener("beforeunload", hold);
    };
  }, [busy]);

  return (
    /*
     * The drop target is a plain container with a real file input inside it,
     * not a click-to-open div. Dragging is the shortcut; the input is the
     * interaction that works with a keyboard, a screen reader and a phone.
     *
     * The two `biome-ignore`s that used to sit here are gone because the drag
     * handlers arrive spread from `useDropZone` and the rule can no longer see
     * them. Worth knowing rather than celebrating: the suppression went, the
     * thing it was suppressing did not.
     */
    <div
      className={`rounded-3xl border p-6 transition-colors duration-200 ${
        isDraggingOver
          ? "border-white/40 bg-white/[0.08]"
          : "border-white/12 bg-white/5"
      }`}
      {...handlers}
    >
      <PanelIntro />

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

      {/*
        Named, and said out loud.

        `Notice` rather than a hand-rolled panel: it already carries the tone
        colours, the icon and the `aria-live` region, and a second spelling of
        "a faint bordered box" is how the surface vocabulary drifts apart.
        Its warning tone announces politely, which is what this is — nothing
        failed, some files were simply not taken.
      */}
      {skipped.length > 0 ? (
        <Notice className="mt-3" tone="warning">
          {skipped.length === 1
            ? `“${skipped[0]}” was not added. `
            : `${skipped.length} files were not added. `}
          The gallery takes JPEG, PNG, WebP and AVIF — camera RAW and HEIC have
          to be exported first, which most photo apps call “Export” or “Save a
          copy”.
          {/* /55 is the AA floor on this ground; `design.test.ts` enforces it. */}
          {skipped.length > 1 ? (
            <span className="mt-1.5 block text-white/55">
              {skipped.join(", ")}
            </span>
          ) : null}
        </Notice>
      ) : null}

      <UploadList
        announcement={announce(items, busy)}
        busy={busy}
        items={items}
        percent={percent}
      />

      {finished ? (
        <BatchSummary
          added={items.length - failures.length}
          failed={failures.length}
          onDismiss={dismiss}
          onRetry={retryFailed}
        />
      ) : null}
    </div>
  );
}
