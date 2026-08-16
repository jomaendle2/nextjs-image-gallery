"use client";

import { Check, Link2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/** How long the confirmation glyph stays before returning to the link icon. */
const CONFIRM_MS = 2000;

/**
 * Whether to offer the operating system's share sheet.
 *
 * Keyed on the pointer, not on `navigator.share` existing. Desktop Chrome
 * exposes `share()`, so feature-detection sends every desktop visitor into an
 * OS dialog they did not ask for, and the button does nothing at all where
 * that dialog is unavailable. A share sheet is what a phone expects; on a
 * desktop, a share button has always really meant "give me the link".
 */
function prefersShareSheet(): boolean {
  return (
    typeof navigator.share === "function" &&
    typeof globalThis.matchMedia === "function" &&
    globalThis.matchMedia("(pointer: coarse)").matches
  );
}

/**
 * Hands the reader a link to whatever they are looking at.
 *
 * Generalised from the photograph-only version, because a photographer's own
 * page had no way to share it at all — the one URL they would actually send
 * about their work, and the site offered no affordance for it. The sharing
 * logic was never photo-specific; only the label was.
 *
 * `label` is what a screen reader hears and what the OS sheet is titled.
 * Nothing about the button changes size when the state changes: the glyph
 * swaps and the box does not, because these sit in bars that were
 * deliberately made immovable.
 *
 * The confirmation state is reset by remounting — pass a `key` that changes
 * with the subject. An effect that resets on a prop change is the shape that
 * already went wrong here once, showing a ✓ over the wrong photograph.
 */
export function ShareButton({
  path,
  label,
  title,
  text,
  className = "",
}: {
  /** Absolute path on this site, e.g. `/by/jo-maendle`. */
  path: string;
  /** What is being shared, for assistive technology: "this photograph". */
  label: string;
  /** Title for the OS share sheet. */
  title: string;
  text?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  const handleShare = useCallback(async () => {
    const url = `${globalThis.location.origin}${path}`;

    if (prefersShareSheet()) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        // Closing the sheet is a decision, not a failure — respect it and
        // stop. Anything else means the sheet did not work, so fall through
        // to the clipboard rather than leaving the button dead.
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => setCopied(false), CONFIRM_MS);
    } catch (error) {
      // A clipboard write the browser would not permit. Not worth
      // interrupting somebody who is looking at a photograph.
      console.error("Could not copy the link:", error);
    }
  }, [path, title, text]);

  return (
    <button
      aria-label={`Copy a link to ${label}`}
      className={`-mx-4 -my-1.5 inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 py-1.5 text-[0.6875rem] uppercase tracking-[0.14em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80 ${className}`}
      onClick={handleShare}
      type="button"
    >
      {copied ? (
        <Check aria-hidden="true" size={13} strokeWidth={2.25} />
      ) : (
        <Link2 aria-hidden="true" size={13} strokeWidth={2.25} />
      )}
      {/*
        The word is for assistive technology only, so the visible control
        keeps its fixed size while the announcement still changes.
      */}
      <span aria-live="polite" className="sr-only">
        {copied ? "Link copied" : "Share"}
      </span>
    </button>
  );
}
