"use client";

import type { ChangeEvent } from "react";
import { SearchField } from "@/components/ui/SearchField";
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
      <SearchField
        className="flex-1"
        label="Search your photographs by title or location"
        onChange={onQueryChange}
        onClear={onClearQuery}
        placeholder="Search by title or location"
        value={query}
      />

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
            className={`inline-flex min-h-11 cursor-pointer items-center rounded-lg px-3 font-medium text-[0.8125rem] transition-colors focus-within:outline-2 focus-within:outline-white/80 ${
              filter === value
                ? "bg-white/10 text-white"
                : "text-white/55 hover:text-white/80"
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
