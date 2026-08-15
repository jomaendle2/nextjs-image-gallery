"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useCallback, useRef, useState } from "react";
import { GlassButton } from "@/components/ui/glass-button";

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
const MAX_BYTES = 25 * 1024 * 1024;
const PERCENT = 100;

type Phase =
  | { kind: "idle" }
  | { kind: "uploading"; percent: number }
  | { kind: "deriving" }
  | { kind: "error"; message: string };

/**
 * Uploads straight from the browser to Blob, then asks the server to read the
 * file back and derive its metadata.
 *
 * `multipart` matters more than it looks: photographers routinely upload
 * 20 MB originals, and a single PUT that fails at 90% has to start over.
 */
export function UploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const handleFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_BYTES) {
        setPhase({ kind: "error", message: "That file is larger than 25 MB." });
        return;
      }

      setPhase({ kind: "uploading", percent: 0 });

      try {
        const blob = await upload(`photos/${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/uploads/token",
          multipart: true,
          onUploadProgress: ({ percentage }) => {
            setPhase({ kind: "uploading", percent: Math.round(percentage) });
          },
        });

        setPhase({ kind: "deriving" });

        const response = await fetch("/api/photos/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blobUrl: blob.url }),
        });

        if (!response.ok) {
          const body = (await response.json()) as { error?: string };
          throw new Error(body.error ?? "That upload could not be read.");
        }

        setPhase({ kind: "idle" });
        if (inputRef.current) {
          inputRef.current.value = "";
        }
        router.refresh();
      } catch (error) {
        setPhase({
          kind: "error",
          message:
            error instanceof Error ? error.message : "The upload failed.",
        });
      }
    },
    [router],
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        handleFile(file).catch((error: unknown) => {
          console.error("Upload failed:", error);
        });
      }
    },
    [handleFile],
  );

  const dismissError = useCallback(() => {
    setPhase({ kind: "idle" });
  }, []);

  const busy = phase.kind === "uploading" || phase.kind === "deriving";

  return (
    <div className="rounded-3xl border border-white/12 bg-white/5 p-6">
      <h2 className="font-semibold text-lg tracking-[-0.03em]">Add a photo</h2>
      <p className="mt-1 mb-4 text-sm text-white/55">
        JPEG, PNG, WebP or AVIF, up to 25 MB. Upload the full-size original — it
        is stored as you sent it. Camera and exposure details are read from the
        file; any GPS coordinates are discarded.
      </p>

      <input
        accept={ACCEPT}
        aria-label="Choose a photograph to upload"
        className="block w-full text-sm text-white/70 file:mr-4 file:cursor-pointer file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:font-medium file:text-sm file:text-white hover:file:bg-white/20"
        disabled={busy}
        onChange={handleChange}
        ref={inputRef}
        type="file"
      />

      {phase.kind === "uploading" ? (
        <div className="mt-4">
          <div
            aria-label="Upload progress"
            aria-valuemax={PERCENT}
            aria-valuemin={0}
            aria-valuenow={phase.percent}
            className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
            role="progressbar"
          >
            <div
              className="h-full rounded-full bg-white/70 transition-[width] duration-200"
              style={{ width: `${phase.percent}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-white/55">
            Uploading… {phase.percent}%
          </p>
        </div>
      ) : null}

      {phase.kind === "deriving" ? (
        <p aria-live="polite" className="mt-4 text-sm text-white/55">
          Reading the file…
        </p>
      ) : null}

      {phase.kind === "error" ? (
        <p
          className="mt-4 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/80"
          role="alert"
        >
          {phase.message}{" "}
          <GlassButton className="ml-2" onClick={dismissError} size="sm">
            Try again
          </GlassButton>
        </p>
      ) : null}
    </div>
  );
}
