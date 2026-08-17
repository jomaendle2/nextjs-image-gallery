"use client";

import { type DragEvent, useCallback, useRef, useState } from "react";

/**
 * Dragging files onto something, with the four handlers that actually takes.
 *
 * Its own hook because it is four event handlers, a ref and a piece of state
 * that only ever talk to each other, and because none of it is about uploading:
 * `UploadForm` wants to know that some files arrived and nothing else. It had
 * grown into a third of that component and pushed it past the line limit, which
 * was the prompt rather than the reason.
 *
 * `depth` rather than a boolean, and that is the one subtlety worth keeping:
 * dragging across a child element fires `dragleave` on the parent, so a boolean
 * flickers the highlight off every time the pointer crosses the text inside the
 * zone.
 */
export function useDropZone({
  busy,
  accept,
  onFiles,
}: {
  /** While true, a drop is ignored — a batch is already going up. */
  busy: boolean;
  /** The MIME types to keep. A drop bypasses the input's `accept` entirely. */
  accept: ReadonlySet<string>;
  onFiles: (files: File[]) => void;
}) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const depth = useRef(0);

  const onDragEnter = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    depth.current += 1;
    setIsDraggingOver(true);
  }, []);

  const onDragLeave = useCallback(() => {
    depth.current -= 1;
    if (depth.current <= 0) {
      depth.current = 0;
      setIsDraggingOver(false);
    }
  }, []);

  const onDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    // Without this the browser navigates to the dropped file.
    event.preventDefault();
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      depth.current = 0;
      setIsDraggingOver(false);
      if (busy) {
        return;
      }
      /*
       * Filtered by type here as well as by the input's `accept`, because a
       * drop bypasses the file picker entirely — without this, dragging a
       * folder of RAWs in would start twenty uploads the server will refuse.
       */
      onFiles([...event.dataTransfer.files].filter((f) => accept.has(f.type)));
    },
    [busy, accept, onFiles],
  );

  return {
    isDraggingOver,
    /** Spread onto the element that is the target. */
    handlers: { onDragEnter, onDragLeave, onDragOver, onDrop },
  };
}
