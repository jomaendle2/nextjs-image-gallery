"use client";

import { ChevronDown } from "lucide-react";
import { type ChangeEvent, useCallback, useMemo, useState } from "react";
import { useServerAction } from "@/hooks/useServerAction";
import type { OwnPhotoRow } from "@/lib/photos/types";
import { bulkRemovePhotos, bulkSetPublished } from "./actions";
import { BulkBar } from "./BulkBar";
import {
  countByStatus,
  type PhotoFilter,
  selectionState,
  selectPhotos,
  toggleAll,
} from "./filter";
import { PhotoCard } from "./PhotoCard";
import { PhotoFilters } from "./PhotoFilters";
import { SelectAll } from "./SelectAll";

/**
 * Finding one photograph among many.
 *
 * Filtering happens in the browser rather than the database, and that is a
 * decision with a limit attached: the page already loads every one of a
 * contributor's rows, so filtering here costs nothing and works instantly
 * with no round trip. It stops being right somewhere north of a few hundred
 * photographs, at which point the query — and `listOwnPhotos`, which has no
 * LIMIT — is what needs to change, not this component.
 *
 * Measured with `npm run probe:scale` rather than guessed; the numbers are
 * in `docs/next-version.md`. Re-run it rather than re-reasoning.
 *
 * This component owns the state and nothing else: the two bars it composes
 * are in their own files, and the filtering itself is in `filter.ts`, where
 * it can be tested without rendering anything.
 */

/*
 * How many rows to render before asking.
 *
 * A cap and a button, not numbered pages. Filtering searches the whole set
 * rather than the visible window, so narrowing never misses a match that
 * happened to fall past the cap — which is how paginated search usually goes
 * wrong.
 */
const INITIAL_ROWS = 30;

/** Below this there is nothing to sift through, so the controls are noise. */
const CONTROLS_APPEAR_AT = 4;

export function PhotoList({ photos }: { photos: OwnPhotoRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PhotoFilter>("all");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { pending, error, run } = useServerAction();

  const armDelete = useCallback(() => setConfirmingDelete(true), []);
  const cancelDelete = useCallback(() => setConfirmingDelete(false), []);
  const revealAll = useCallback(() => setShowAll(true), []);

  const toggleOne = useCallback((id: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
    setConfirmingDelete(false);
  }, []);

  /*
   * Stable handlers throughout. Inline closures here would be recreated on
   * every keystroke in the search box, re-rendering the whole list behind
   * it — and `PhotoCard` renders a next/image thumbnail apiece, so this is
   * the difference between typing smoothly at fifty photographs and
   * stuttering.
   */
  const publishSelected = useCallback(() => {
    run(async () => {
      await bulkSetPublished([...selected], true);
      clearSelection();
    });
  }, [run, selected, clearSelection]);

  const unpublishSelected = useCallback(() => {
    run(async () => {
      await bulkSetPublished([...selected], false);
      clearSelection();
    });
  }, [run, selected, clearSelection]);

  const deleteSelected = useCallback(() => {
    run(async () => {
      await bulkRemovePhotos([...selected]);
      clearSelection();
    });
  }, [run, selected, clearSelection]);

  const onQueryChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value),
    [],
  );
  const clearQuery = useCallback(() => setQuery(""), []);

  /*
   * One handler on the group rather than a closure per radio. The value is
   * read off the event, which is what a native radio group gives us for
   * free.
   */
  const onFilterChange = useCallback(
    (event: ChangeEvent<HTMLFieldSetElement>) => {
      const target = event.target as unknown as HTMLInputElement;
      setFilter(target.value as PhotoFilter);
    },
    [],
  );

  const counts = useMemo(() => countByStatus(photos), [photos]);
  const visible = useMemo(
    () => selectPhotos(photos, filter, query),
    [photos, filter, query],
  );
  const chosen = useMemo(
    () => photos.filter((photo) => selected.has(photo.id)),
    [photos, selected],
  );
  const allState = useMemo(
    () => selectionState(selected, visible),
    [selected, visible],
  );

  const toggleAllVisible = useCallback(() => {
    setSelected((current) => toggleAll(current, visible));
  }, [visible]);

  if (photos.length === 0) {
    return (
      <p className="mt-8 text-white/55">
        Nothing here yet. Upload your first photograph above.
      </p>
    );
  }

  return (
    <div className="mt-8">
      {photos.length > CONTROLS_APPEAR_AT ? (
        <PhotoFilters
          counts={counts}
          filter={filter}
          onClearQuery={clearQuery}
          onFilterChange={onFilterChange}
          onQueryChange={onQueryChange}
          query={query}
        />
      ) : null}

      {visible.length === 0 ? null : (
        <SelectAll
          matching={visible.length}
          onToggle={toggleAllVisible}
          state={allState}
        />
      )}

      {chosen.length === 0 ? null : (
        <BulkBar
          chosen={chosen}
          confirmingDelete={confirmingDelete}
          error={error}
          onArmDelete={armDelete}
          onCancelDelete={cancelDelete}
          onClear={clearSelection}
          onDelete={deleteSelected}
          onPublish={publishSelected}
          onUnpublish={unpublishSelected}
          pending={pending}
        />
      )}

      {visible.length === 0 ? (
        <p className="rounded-2xl bg-white/[0.03] px-4 py-8 text-center text-sm text-white/55">
          Nothing matches{query.trim() === "" ? " that filter" : ` “${query}”`}.
        </p>
      ) : (
        <ul className="space-y-3">
          {(showAll ? visible : visible.slice(0, INITIAL_ROWS)).map((photo) => (
            <PhotoCard
              key={photo.id}
              onSelect={toggleOne}
              photo={photo}
              selected={selected.has(photo.id)}
            />
          ))}
        </ul>
      )}

      {!showAll && visible.length > INITIAL_ROWS ? (
        <button
          className="glass-hairline mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-2xl px-5 font-medium text-sm text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
          onClick={revealAll}
          type="button"
        >
          <ChevronDown aria-hidden="true" className="mr-1.5" size={15} />
          Show the other {visible.length - INITIAL_ROWS}
        </button>
      ) : null}
    </div>
  );
}
