"use client";

import { Eye, EyeOff, Pin } from "lucide-react";
import { useCallback } from "react";
import { ActionError } from "@/components/ui/ActionError";
import { GlassButton } from "@/components/ui/glass-button";
import { useServerAction } from "@/hooks/useServerAction";
import type { OwnPhotoRow } from "@/lib/photos/types";
import { ownerSetPublished, pinOpener } from "./actions";

export function PhotoRowActions({ photo }: { photo: OwnPhotoRow }) {
  const { pending, error, run } = useServerAction();
  const isPublished = photo.published_at !== null;

  const toggle = useCallback(() => {
    run(() => ownerSetPublished(photo.id, !isPublished));
  }, [run, photo.id, isPublished]);

  const pin = useCallback(() => {
    run(() => pinOpener(photo.id));
  }, [run, photo.id]);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {/*
          Icons here rather than everywhere: these two repeat once per
          photograph down a list that reaches into the hundreds, and at that
          length the shape is what somebody scans for rather than the word.
          A lone Save button gains nothing from the same treatment.
        */}
        <GlassButton disabled={pending} onClick={toggle} size="sm">
          {isPublished ? (
            <EyeOff aria-hidden="true" className="mr-1.5" size={14} />
          ) : (
            <Eye aria-hidden="true" className="mr-1.5" size={14} />
          )}
          {isPublished ? "Unpublish" : "Publish"}
        </GlassButton>
        {isPublished && !photo.is_opener ? (
          <GlassButton disabled={pending} onClick={pin} size="sm">
            <Pin aria-hidden="true" className="mr-1.5" size={14} />
            Pin as opener
          </GlassButton>
        ) : null}
      </div>
      <ActionError message={error} />
    </div>
  );
}
