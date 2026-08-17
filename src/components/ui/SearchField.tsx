"use client";

import { Search, X } from "lucide-react";
import type { ChangeEvent } from "react";
import { FIELD } from "@/components/ui/field";
import { cn } from "@/lib/utils";

interface SearchFieldProps {
  /** Announced to screen readers; the visible cue is the magnifier alone. */
  label: string;
  placeholder: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  /** Wrapper classes — the two call sites sit in different layouts. */
  className?: string;
}

/**
 * A search input with a leading magnifier and a clear button.
 *
 * Both dashboards had this markup character-for-character, which matters more
 * than the line count: the clear button's `size-11` and `-mr-1` are what put
 * a 44px target inside a 40px field, and a second copy is a second place for
 * that to be tidied away by someone who reads `-mr-1` as a mistake.
 */
export function SearchField({
  label,
  placeholder,
  value,
  onChange,
  onClear,
  className,
}: SearchFieldProps) {
  return (
    <div className={cn("relative", className)}>
      <Search
        aria-hidden="true"
        className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3.5 text-white/50"
        size={15}
      />
      <input
        aria-label={label}
        className={`${FIELD} pl-10`}
        onChange={onChange}
        placeholder={placeholder}
        type="search"
        value={value}
      />
      {value === "" ? null : (
        <button
          aria-label="Clear search"
          className="-translate-y-1/2 -mr-1 absolute top-1/2 right-2 flex size-11 items-center justify-center rounded-full text-white/55 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-white/80"
          onClick={onClear}
          type="button"
        >
          <X aria-hidden="true" size={14} />
        </button>
      )}
    </div>
  );
}
