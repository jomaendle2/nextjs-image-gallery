"use client";

import { useCallback } from "react";
import { GlassButton } from "@/components/ui/glass-button";
import type { OwnPhotoRow } from "@/lib/photos/types";
import { ownerSetPublished, pinOpener } from "./actions";
import { useServerAction } from "./useServerAction";

export function PhotoRowActions({ photo }: { photo: OwnPhotoRow }) {
  const { pending, run } = useServerAction();
  const isPublished = photo.published_at !== null;

  const toggle = useCallback(() => {
    run(() => ownerSetPublished(photo.id, !isPublished));
  }, [run, photo.id, isPublished]);

  const pin = useCallback(() => {
    run(() => pinOpener(photo.id));
  }, [run, photo.id]);

  return (
    <div className="flex flex-wrap gap-2">
      <GlassButton disabled={pending} onClick={toggle} size="sm">
        {isPublished ? "Unpublish" : "Publish"}
      </GlassButton>
      {isPublished && !photo.is_opener ? (
        <GlassButton disabled={pending} onClick={pin} size="sm">
          Pin as opener
        </GlassButton>
      ) : null}
    </div>
  );
}
