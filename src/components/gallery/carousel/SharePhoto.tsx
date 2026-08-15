"use client";

import { Check, Link2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GalleryImage } from "@/data/galleryData";

/** How long the confirmation glyph stays before returning to the link icon. */
const CONFIRM_MS = 2000;

interface SharePhotoProps {
  image: GalleryImage;
}

/**
 * Whether to offer the operating system's share sheet.
 *
 * Keyed on the pointer, not on `navigator.share` existing — which was the
 * first version of this and was wrong. Desktop Chrome exposes `share()`, so
 * feature-detection sent every desktop visitor into an OS dialog they did
 * not ask for, and the button did nothing at all where that dialog is
 * unavailable. A share sheet is what a phone expects; on a desktop, a share
 * button has always really meant "give me the link".
 */
function prefersShareSheet(): boolean {
  return (
    typeof navigator.share === "function" &&
    typeof globalThis.matchMedia === "function" &&
    globalThis.matchMedia("(pointer: coarse)").matches
  );
}

/**
 * Hands the reader a link to this one photograph.
 *
 * The system share sheet on a phone, the clipboard everywhere else — and the
 * clipboard again if the sheet fails for any reason other than the reader
 * closing it, so the button is never a no-op.
 *
 * Icon-only, and that is a layout decision rather than a stylistic one: a
 * button whose label swaps between "Share" and "Copied" changes width in the
 * middle of a bar that was deliberately made immovable. The glyph changes
 * instead, the box never does, and the state reaches a screen reader through
 * the live region rather than through the size of a word.
 */
export function SharePhoto({ image }: SharePhotoProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A photograph can change under this component while the confirmation is
  // still showing, and the timer would otherwise outlive the page.
  useEffect(() => {
    setCopied(false);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleShare = useCallback(async () => {
    const url = `${globalThis.location.origin}/photo/${image.id}`;
    const title = `${image.title} by ${image.author.name}`;

    if (prefersShareSheet()) {
      try {
        await navigator.share({ title, text: image.description, url });
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
      timerRef.current = setTimeout(() => {
        setCopied(false);
      }, CONFIRM_MS);
    } catch (error) {
      // A clipboard write the browser would not permit. Not worth
      // interrupting someone who is looking at a photograph.
      console.error("Could not copy the link:", error);
    }
  }, [image.id, image.title, image.author.name, image.description]);

  return (
    <button
      aria-label={`Copy a link to ${image.title === "" ? "this photograph" : image.title}`}
      /*
       * Padded horizontally as well as vertically, and pulled back out both
       * ways. The icon is 13px wide, so `min-h-11` alone gave a target 13px
       * across — tall enough to measure as compliant and still a poor thing
       * to hit with a thumb. The negative margins mean the caption bar's
       * measured layout is unchanged.
       */
      className="-mx-4 -my-1.5 inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 py-1.5 text-[0.6875rem] text-white/40 uppercase tracking-[0.14em] transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80"
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
