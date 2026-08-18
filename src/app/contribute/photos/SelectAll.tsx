"use client";

import { CheckSquare, MinusSquare, Square } from "lucide-react";
import { useEffect, useRef } from "react";
import { count } from "@/lib/plural";

/**
 * One control to select everything the filter currently matches.
 *
 * Without it the bulk bar did not deliver what it promised. Its own reason
 * for existing was "upload ten photographs, then publish ten photographs" —
 * but reaching the bar still cost ten clicks, one per row, and at fifty
 * drafts it cost fifty. Bulk actions you can only reach one row at a time
 * are not bulk actions.
 *
 * A real `<input type="checkbox">`, visually replaced by an icon. The first
 * version was a `role="checkbox"` button, on the reasoning that the third
 * state is genuine — some of the matched rows are selected — and
 * `indeterminate` is a DOM property no server render can set. That traded a
 * real control for a described one to avoid a one-line effect, which is the
 * wrong way round: the native element brings keyboard behaviour, form
 * semantics and every assistive technology's checkbox handling for free.
 *
 * The label always names the number it is about to act on, and that number
 * comes from the filtered set rather than the rendered one. "Select all"
 * beside a list showing thirty of forty-two is a promise about the other
 * twelve.
 */

const ICONS = {
  none: Square,
  some: MinusSquare,
  all: CheckSquare,
} as const;

export function SelectAll({
  state,
  matching,
  onToggle,
  selecting,
  onSelecting,
}: {
  state: "none" | "some" | "all";
  matching: number;
  onToggle: () => void;
  /** Whether the rows are currently showing their checkboxes. */
  selecting: boolean;
  /** Enter the mode, or leave it. */
  onSelecting: () => void;
}) {
  const box = useRef<HTMLInputElement>(null);
  const Icon = ICONS[state];

  /*
   * Out of the mode, this is the only thing on screen that mentions selecting
   * at all — and that is the point. The per-row checkboxes used to be present
   * always, explained solely by this line, which on a phone sits several
   * screens above the row somebody is actually looking at. An unlabelled box
   * beside a photograph, doing nothing until ticked, is the first thing
   * anybody asks about this page.
   */
  /*
   * `indeterminate` exists only as a property, never as an attribute, so it
   * cannot be expressed in JSX and has to be written after each render.
   *
   * **Above the early return, and that is not a style preference.** Putting
   * the mode's `if (!selecting) return …` before this hook changed how many
   * hooks ran between renders, and React said so the moment anybody entered
   * the mode: "a change in the order of Hooks called by SelectAll". The
   * effect is harmless when the checkbox is not rendered — `box.current` is
   * null and it does nothing — so the fix is to let it run either way rather
   * than to guard it.
   */
  useEffect(() => {
    if (box.current !== null) {
      box.current.indeterminate = state === "some";
    }
  }, [state]);

  if (!selecting) {
    return (
      <button
        className="-ml-2 mb-3 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 font-medium text-sm text-white/55 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
        onClick={onSelecting}
        type="button"
      >
        <Square aria-hidden="true" size={16} />
        Select photographs to publish or delete
      </button>
    );
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
      <label className="-ml-2 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2 font-medium text-sm text-white/55 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-white/80 hover:text-white">
        <input
          checked={state === "all"}
          className="sr-only"
          onChange={onToggle}
          ref={box}
          type="checkbox"
        />
        <Icon
          aria-hidden="true"
          className={state === "none" ? "text-white/55" : "text-white/80"}
          size={16}
        />
        {state === "all"
          ? `Clear ${matching} selected`
          : `Select ${count(matching, "photograph")}`}
      </label>

      {/*
        The way out, and it has to be here rather than only in the bulk bar:
        that bar appears only once something is ticked, so somebody who enters
        the mode and then changes their mind would otherwise have no exit at
        all.
      */}
      <button
        className="inline-flex min-h-11 items-center rounded-xl px-2 font-medium text-sm text-white/55 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
        onClick={onSelecting}
        type="button"
      >
        Done
      </button>
    </div>
  );
}
