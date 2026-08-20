"use client";

import { Check, Link2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { META_TYPE } from "./field";

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

/*
 * `text` is spread in only when there is one. `ShareData`'s fields are
 * optional, and under `exactOptionalPropertyTypes` passing an explicit
 * `undefined` is not the same as omitting the key.
 */
function shareData(title: string, url: string, text?: string): ShareData {
  return { title, url, ...(text === undefined ? {} : { text }) };
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
 * `withLabel` puts the word beside the glyph, for the one place a bare
 * 13px chain icon is not enough: the first-publish card, where it stands
 * next to a fully-worded link at the most important moment in the flow. The
 * visible word is *static* and `aria-hidden` on purpose — it preserves the
 * fixed width the paragraph above protects, the icon swapping to a check
 * remains the sighted feedback, and the announcement stays in the live
 * region below rather than being read twice.
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
  withLabel = false,
  className = "",
}: {
  /** Absolute path on this site, e.g. `/by/jo-maendle`. */
  path: string;
  /** What is being shared, for assistive technology: "this photograph". */
  label: string;
  /** Title for the OS share sheet. */
  title: string;
  text?: string;
  /** Show a static "Copy link" beside the glyph. */
  withLabel?: boolean;
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
        await navigator.share(shareData(title, url, text));
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
      className={`${META_TYPE} -mx-4 -my-1.5 inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80 ${className}`}
      onClick={handleShare}
      type="button"
    >
      {copied ? (
        <Check aria-hidden="true" size={13} strokeWidth={2.25} />
      ) : (
        <Link2 aria-hidden="true" size={13} strokeWidth={2.25} />
      )}
      {withLabel ? <span aria-hidden="true">Copy link</span> : null}
      {/*
        The announcement is for assistive technology only, so the visible
        control keeps its fixed size while what is announced still changes.
      */}
      <span aria-live="polite" className="sr-only">
        {copied ? "Link copied" : "Share"}
      </span>
    </button>
  );
}
