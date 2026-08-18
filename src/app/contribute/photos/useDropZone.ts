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
  onFiles,
}: {
  /** While true, a drop is ignored — a batch is already going up. */
  busy: boolean;
  /**
   * Everything that was dropped, unfiltered.
   *
   * This hook used to drop anything outside an `accept` set before the caller
   * ever saw it, which is how a photographer dragging in a folder of `.HEIC`
   * or `.CR3` got the zone highlighting and then nothing at all — no row, no
   * count, no refusal. Silence is the worst answer available: it is
   * indistinguishable from the feature being broken.
   *
   * Deciding what is uploadable belongs to the caller now, because the file
   * picker has exactly the same problem — `accept` on an input is a filter in
   * the dialog, not a guarantee, and anybody who switches it to "All Files"
   * arrives here by the other door. One rule, applied to both.
   */
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
      onFiles([...event.dataTransfer.files]);
    },
    [busy, onFiles],
  );

  return {
    isDraggingOver,
    /** Spread onto the element that is the target. */
    handlers: { onDragEnter, onDragLeave, onDragOver, onDrop },
  };
}
