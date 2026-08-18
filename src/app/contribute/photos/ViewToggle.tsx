"use client";

import { LayoutGrid, Rows3 } from "lucide-react";
import type { ChangeEvent } from "react";
import { LAYOUTS, type PhotoLayout } from "./view";

/**
 * List or grid, chosen the same way the status filter is chosen.
 *
 * A radio group rather than two buttons or one toggle, matching
 * `PhotoFilters` exactly: these are two states of one setting, and a screen
 * reader should hear which is chosen rather than two unrelated controls or a
 * button whose label is the state it is not in.
 *
 * The icons carry the meaning and the words are still there beside them. A
 * pair of unlabelled glyphs is guessable rather than readable, and this
 * control sits in a rail with room for four more characters.
 */

const ICONS: Record<PhotoLayout, typeof Rows3> = {
  list: Rows3,
  grid: LayoutGrid,
};

export function ViewToggle({
  layout,
  onChange,
}: {
  layout: PhotoLayout;
  onChange: (event: ChangeEvent<HTMLFieldSetElement>) => void;
}) {
  return (
    <fieldset
      className="flex gap-1 rounded-xl bg-white/[0.04] p-1"
      onChange={onChange}
    >
      <legend className="sr-only">How to show your photographs</legend>
      {LAYOUTS.map(({ value, label }) => {
        const Icon = ICONS[value];
        return (
          <label
            className={`inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 font-medium text-[0.8125rem] transition-colors focus-within:outline-2 focus-within:outline-white/80 ${
              layout === value
                ? "bg-white/10 text-white"
                : "text-white/55 hover:text-white/80"
            }`}
            key={value}
          >
            <input
              checked={layout === value}
              className="sr-only"
              name="photo-layout"
              readOnly={true}
              type="radio"
              value={value}
            />
            <Icon aria-hidden="true" size={15} />
            {label}
          </label>
        );
      })}
    </fieldset>
  );
}
