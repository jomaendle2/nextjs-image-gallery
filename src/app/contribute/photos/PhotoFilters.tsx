"use client";

import { Search, X } from "lucide-react";
import type { ChangeEvent } from "react";
import { FIELD } from "@/components/ui/field";
import type { PhotoFilter } from "./filter";
import { FILTERS } from "./filter";

/**
 * The search box and the status filter.
 *
 * Split out of `PhotoList` when that component passed four hundred lines.
 * The state still lives in the parent — this owns no decisions, only the
 * markup for two of them — because the filter also drives the list, the
 * empty message and the row cap, and a component that held it would have to
 * hand it straight back.
 */
export function PhotoFilters({
  query,
  filter,
  counts,
  onQueryChange,
  onClearQuery,
  onFilterChange,
}: {
  query: string;
  filter: PhotoFilter;
  counts: Record<PhotoFilter, number>;
  onQueryChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClearQuery: () => void;
  onFilterChange: (event: ChangeEvent<HTMLFieldSetElement>) => void;
}) {
  return (
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
            onClick={onClearQuery}
            type="button"
          >
            <X aria-hidden="true" size={14} />
          </button>
        )}
      </div>

      {/*
        A radio group rather than buttons: these are three states of one
        setting, and a screen reader should hear which is chosen rather than
        three unrelated controls.
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
  );
}
