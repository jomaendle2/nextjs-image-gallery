"use client";

import { CheckSquare, Eye, EyeOff, Trash2 } from "lucide-react";
import { ActionError } from "@/components/ui/ActionError";
import { GlassButton } from "@/components/ui/glass-button";
import type { OwnPhotoRow } from "@/lib/photos/types";
import { count } from "@/lib/plural";

/**
 * The bar that appears once rows are ticked.
 *
 * It exists for one workflow that was genuinely tedious: upload ten
 * photographs, then publish ten photographs, which meant ten
 * expand-click-collapse cycles down the list.
 *
 * Deleting is here too, behind a confirmation that names the titles rather
 * than a count — a count cannot be checked against intent, but a misclicked
 * row appears as a name the person did not expect to read.
 */

/** How many titles to list before summarising the rest. */
const NAMED_IN_CONFIRMATION = 8;

function titleOf(photo: OwnPhotoRow): string {
  return (photo.title ?? "").trim() === "" ? "Untitled" : (photo.title ?? "");
}

function DeleteConfirmation({
  chosen,
  pending,
  onCancel,
  onConfirm,
}: {
  chosen: OwnPhotoRow[];
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const extra = chosen.length - NAMED_IN_CONFIRMATION;

  return (
    <div className="w-full space-y-3 border-white/10 border-t pt-3">
      <p className="text-sm text-danger">
        Delete {count(chosen.length, "photograph")} for good? The stored files
        go too, and nothing here can bring them back.
      </p>
      {/*
        Titles rather than a count. "Delete 9 photographs?" cannot be checked
        against what somebody meant; nine names can. Capped so the bar stays
        a bar, with the remainder counted.
      */}
      <ul className="space-y-0.5 text-white/60 text-xs">
        {chosen.slice(0, NAMED_IN_CONFIRMATION).map((photo) => (
          <li className="truncate" key={photo.id}>
            {titleOf(photo)}
          </li>
        ))}
        {extra > 0 ? <li className="text-white/55">and {extra} more</li> : null}
      </ul>
      <div className="flex flex-wrap gap-2">
        <GlassButton
          autoFocus={true}
          disabled={pending}
          onClick={onCancel}
          size="sm"
        >
          Keep them
        </GlassButton>
        <GlassButton
          variant="danger"
          disabled={pending}
          onClick={onConfirm}
          size="sm"
        >
          <Trash2 aria-hidden="true" className="mr-1.5" size={14} />
          {pending ? "Deleting…" : `Delete ${chosen.length} for good`}
        </GlassButton>
      </div>
    </div>
  );
}

export function BulkBar({
  chosen,
  pending,
  error,
  confirmingDelete,
  onPublish,
  onUnpublish,
  onClear,
  onArmDelete,
  onCancelDelete,
  onDelete,
}: {
  chosen: OwnPhotoRow[];
  pending: boolean;
  error: string | null;
  confirmingDelete: boolean;
  onPublish: () => void;
  onUnpublish: () => void;
  onClear: () => void;
  onArmDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="glass-hairline mb-4 flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3">
      <span className="font-medium text-sm text-white/80">
        <CheckSquare aria-hidden="true" className="mr-1.5 inline" size={14} />
        {chosen.length} selected
      </span>

      <div className="ml-auto flex flex-wrap gap-2">
        {confirmingDelete ? null : (
          <>
            <GlassButton disabled={pending} onClick={onPublish} size="sm">
              <Eye aria-hidden="true" className="mr-1.5" size={14} />
              Publish
            </GlassButton>
            <GlassButton disabled={pending} onClick={onUnpublish} size="sm">
              <EyeOff aria-hidden="true" className="mr-1.5" size={14} />
              Unpublish
            </GlassButton>
            <GlassButton disabled={pending} onClick={onClear} size="sm">
              Clear
            </GlassButton>
            <GlassButton
              variant="arm"
              disabled={pending}
              onClick={onArmDelete}
              size="sm"
            >
              <Trash2 aria-hidden="true" className="mr-1.5" size={14} />
              Delete
            </GlassButton>
          </>
        )}
      </div>

      {confirmingDelete ? (
        <DeleteConfirmation
          chosen={chosen}
          onCancel={onCancelDelete}
          onConfirm={onDelete}
          pending={pending}
        />
      ) : null}

      <div className="w-full">
        <ActionError message={error} />
      </div>
    </div>
  );
}
