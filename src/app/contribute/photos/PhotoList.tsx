"use client";

import { CheckSquare, Eye, EyeOff, Search, X } from "lucide-react";
import { type ChangeEvent, useCallback, useMemo, useState } from "react";
import { ActionError } from "@/components/ui/ActionError";
import { FIELD } from "@/components/ui/field";
import { GlassButton } from "@/components/ui/glass-button";
import { useServerAction } from "@/hooks/useServerAction";
import type { OwnPhotoRow } from "@/lib/photos/types";
import { bulkSetPublished } from "./actions";
import { PhotoCard } from "./PhotoCard";

/**
 * Finding one photograph among many.
 *
 * Filtering happens in the browser rather than the database, and that is a
 * decision with a limit attached: the page already loads every one of a
 * contributor's rows, so filtering here costs nothing and works instantly
 * with no round trip. It stops being right somewhere north of a few hundred
 * photographs, at which point the query — and `listOwnPhotos`, which has no
 * LIMIT — is what needs to change, not this component. Written down so the
 * next person meets the ceiling on purpose rather than by surprise.
 *
 * There is no pagination for the same reason: a filter that narrows fifty
 * rows to three is a better answer than pages of ten, and it does not hide
 * anything behind a click.
 */

type Filter = "all" | "published" | "draft";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Drafts" },
];

function matches(photo: OwnPhotoRow, needle: string): boolean {
  if (needle === "") {
    return true;
  }
  /*
   * Title and location only. Description is deliberately excluded: it is
   * long, so searching it returns rows whose match is invisible in the
   * collapsed summary — the person sees a result and cannot tell why.
   */
  return (
    (photo.title ?? "").toLowerCase().includes(needle) ||
    (photo.location ?? "").toLowerCase().includes(needle)
  );
}

export function PhotoList({ photos }: { photos: OwnPhotoRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const { pending, error, run } = useServerAction();

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

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  /*
   * Stable handlers for the bulk bar. Inline closures here would be
   * recreated on every keystroke in the search box, re-rendering the whole
   * list behind it.
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

  /*
   * Stable references, so a keystroke re-renders the input rather than every
   * card in the list. `PhotoCard` renders a next/image thumbnail apiece, so
   * this is the difference between a search box that types smoothly at fifty
   * photographs and one that stutters.
   */
  const onQueryChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value),
    [],
  );
  const clearQuery = useCallback(() => setQuery(""), []);

  /*
   * One handler on the group rather than a closure per radio. The value is
   * read off the event, which is what a native radio group gives us for
   * free — three per-item closures would be recreated on every keystroke in
   * the search box above.
   */
  const onFilterChange = useCallback(
    (event: ChangeEvent<HTMLFieldSetElement>) => {
      const target = event.target as unknown as HTMLInputElement;
      setFilter(target.value as Filter);
    },
    [],
  );

  const counts = useMemo(
    () => ({
      all: photos.length,
      published: photos.filter((p) => p.published_at !== null).length,
      draft: photos.filter((p) => p.published_at === null).length,
    }),
    [photos],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return photos.filter((photo) => {
      if (filter === "published" && photo.published_at === null) {
        return false;
      }
      if (filter === "draft" && photo.published_at !== null) {
        return false;
      }
      return matches(photo, needle);
    });
  }, [photos, query, filter]);

  if (photos.length === 0) {
    return (
      <p className="mt-8 text-white/55">
        Nothing here yet. Upload your first photograph above.
      </p>
    );
  }

  return (
    <div className="mt-8">
      {/*
        The controls only earn their space once there is enough to sift
        through. Below that they are chrome around a list you can already
        see all of.
      */}
      {photos.length > 4 ? (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              aria-hidden="true"
              className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3.5 text-white/30"
              size={15}
            />
            <input
              aria-label="Search your photographs by title or location"
              className={`${FIELD} pl-10`}
              onChange={onQueryChange}
              placeholder="Search by title or location"
              type="search"
              value={query}
            />
            {query === "" ? null : (
              <button
                aria-label="Clear search"
                className="-translate-y-1/2 absolute top-1/2 right-2 flex size-8 items-center justify-center rounded-full text-white/40 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-white/80"
                onClick={clearQuery}
                type="button"
              >
                <X aria-hidden="true" size={14} />
              </button>
            )}
          </div>

          {/*
            A radio group rather than buttons: these are three states of one
            setting, and a screen reader should hear which is chosen rather
            than three unrelated controls.
          */}
          <fieldset
            className="flex shrink-0 gap-1 rounded-xl bg-white/[0.04] p-1"
            onChange={onFilterChange}
          >
            <legend className="sr-only">Filter by status</legend>
            {FILTERS.map(({ value, label }) => (
              <label
                className={`inline-flex min-h-9 cursor-pointer items-center rounded-lg px-3 font-medium text-[0.8125rem] transition-colors focus-within:outline-2 focus-within:outline-white/80 ${
                  filter === value
                    ? "bg-white/10 text-white"
                    : "text-white/50 hover:text-white/80"
                }`}
                key={value}
              >
                <input
                  checked={filter === value}
                  className="sr-only"
                  name="photo-filter"
                  readOnly={true}
                  type="radio"
                  value={value}
                />
                {label}
                <span className="ml-1.5 tabular-nums opacity-50">
                  {counts[value]}
                </span>
              </label>
            ))}
          </fieldset>
        </div>
      ) : null}

      {/*
        The bulk bar exists for one workflow that was genuinely tedious:
        upload ten photographs, then publish ten photographs, which meant
        ten expand-click-collapse cycles down the list.

        There is no bulk delete, deliberately. Deleting is irreversible and
        takes the blobs with it, so it stays one photograph at a time behind
        its own confirmation — no dialog makes "delete these nine, one of
        which you misclicked" a safe offer.
      */}
      {selected.size === 0 ? null : (
        <div className="glass-hairline mb-4 flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3">
          <span className="font-medium text-sm text-white/80">
            <CheckSquare
              aria-hidden="true"
              className="mr-1.5 inline"
              size={14}
            />
            {selected.size} selected
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <GlassButton disabled={pending} onClick={publishSelected} size="sm">
              <Eye aria-hidden="true" className="mr-1.5" size={14} />
              Publish
            </GlassButton>
            <GlassButton
              disabled={pending}
              onClick={unpublishSelected}
              size="sm"
            >
              <EyeOff aria-hidden="true" className="mr-1.5" size={14} />
              Unpublish
            </GlassButton>
            <GlassButton disabled={pending} onClick={clearSelection} size="sm">
              Clear
            </GlassButton>
          </div>
          <div className="w-full">
            <ActionError message={error} />
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="rounded-2xl bg-white/[0.03] px-4 py-8 text-center text-sm text-white/55">
          Nothing matches{query.trim() === "" ? " that filter" : ` “${query}”`}.
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((photo) => (
            <PhotoCard
              key={photo.id}
              onSelect={toggleOne}
              photo={photo}
              selected={selected.has(photo.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
