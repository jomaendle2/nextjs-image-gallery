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
}: {
  state: "none" | "some" | "all";
  matching: number;
  onToggle: () => void;
}) {
  const box = useRef<HTMLInputElement>(null);
  const Icon = ICONS[state];

  /*
   * `indeterminate` exists only as a property, never as an attribute, so it
   * cannot be expressed in JSX and has to be written after each render.
   */
  useEffect(() => {
    if (box.current !== null) {
      box.current.indeterminate = state === "some";
    }
  }, [state]);

  return (
    <label className="-ml-2 mb-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2 font-medium text-sm text-white/55 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-white/80 hover:text-white">
      <input
        checked={state === "all"}
        className="sr-only"
        onChange={onToggle}
        ref={box}
        type="checkbox"
      />
      <Icon
        aria-hidden="true"
        className={state === "none" ? "text-white/35" : "text-white/80"}
        size={16}
      />
      {state === "all"
        ? `Clear ${matching} selected`
        : `Select ${count(matching, "photograph")}`}
    </label>
  );
}
