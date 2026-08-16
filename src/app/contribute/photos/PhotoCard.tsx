"use client";

import { ChevronDown, Pin } from "lucide-react";
import Image from "next/image";
import { type ChangeEvent, memo, useCallback, useState } from "react";
import type { PhotoExif } from "@/lib/photos/derive";
import type { OwnPhotoRow } from "@/lib/photos/types";
import { PhotoEditForm } from "./PhotoEditForm";

/**
 * One photograph in the dashboard: a row you can scan, opening into a form.
 *
 * The edit form is mounted on first open rather than inline. Always-open
 * is fine for the three photographs it was built against and unusable at
 * fifty: every row was a 255-line form, so finding one picture meant
 * scrolling past every other picture's title, description, location and
 * delete button. The list could not be read, which is a different problem
 * from being slow.
 *
 * `<details>` rather than a state hook, deliberately. It is keyboard
 * accessible for free, it is findable by the browser's own in-page search
 * even while collapsed, and it survives with no JavaScript — which matters
 * on the one page a photographer uses to fix a typo from their phone on bad
 * hotel wifi.
 */

function exifSummary(exif: PhotoExif | null): string | null {
  if (!exif) {
    return null;
  }
  const parts = [
    exif.camera,
    exif.lens,
    exif.focal_length,
    exif.aperture,
    exif.shutter,
    exif.iso === undefined ? undefined : `ISO ${exif.iso}`,
  ].filter((part): part is string => part !== undefined);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Published, draft, or the one pinned to the front of the gallery. */
function Status({ photo }: { photo: OwnPhotoRow }) {
  if (photo.is_opener) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 font-medium text-[0.6875rem] text-amber-100 uppercase tracking-[0.08em]">
        <Pin aria-hidden="true" size={10} />
        Opener
      </span>
    );
  }
  return photo.published_at === null ? (
    <span className="rounded-full bg-white/10 px-2 py-0.5 font-medium text-[0.6875rem] text-white/60 uppercase tracking-[0.08em]">
      Draft
    </span>
  ) : (
    <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 font-medium text-[0.6875rem] text-emerald-100 uppercase tracking-[0.08em]">
      Published
    </span>
  );
}

/**
 * One row, memoized.
 *
 * `PhotoList` stabilises every handler it passes down and its comment
 * explains why: inline closures would be recreated on each keystroke in the
 * search box and re-render the whole list. That reasoning was half a
 * mechanism. A plain function component re-renders whenever its parent does
 * regardless of prop identity, so the stable callbacks bought nothing and
 * every keystroke still re-rendered every rendered row — each one a
 * next/image thumbnail — which is precisely the stutter the callbacks were
 * written to prevent.
 *
 * `memo` is the other half. All three props are stable: `photo` comes from
 * the server-rendered array, `onSelect` is stabilised upstream, `selected`
 * is a boolean. So a keystroke now re-renders the input and nothing else,
 * and ticking one row re-renders one row.
 *
 * Safe with the edit form inside because its inputs are uncontrolled
 * (`defaultValue`), so a skipped render cannot strand typed text.
 */
export const PhotoCard = memo(function PhotoCardRow({
  photo,
  selected,
  onSelect,
}: {
  photo: OwnPhotoRow;
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
}) {
  const exif = exifSummary(photo.exif);
  const untitled = (photo.title ?? "").trim() === "";

  /*
   * The form is mounted on first open and kept thereafter.
   *
   * `<details>` hides its children; it does not stop them rendering. So the
   * collapse fixed the list visually and left every row still shipping a
   * complete edit form — measured at 114 photographs: 1,374 inputs in the
   * DOM with nothing open, and 1.7 MB of HTML for a page showing 114
   * one-line rows.
   *
   * The cost of this is a real trade rather than a free win: a form that
   * only exists after JavaScript runs cannot be submitted without it, and
   * the earlier note here claimed no-JS support as a virtue. On balance
   * 1.7 MB over hotel wifi is the worse failure, and it is one everybody
   * pays rather than a few. The summary — title, location, status — still
   * renders server-side for every row.
   *
   * Kept mounted once opened, so a half-typed caption survives collapsing
   * the row by accident.
   */
  const [opened, setOpened] = useState(false);
  const handleToggle = useCallback(() => setOpened(true), []);

  /* Stable, so ticking one box does not re-render every other row. */
  const handleSelect = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      onSelect?.(photo.id, event.target.checked),
    [onSelect, photo.id],
  );

  return (
    <li className="glass-thin flex items-stretch overflow-hidden rounded-3xl">
      {/*
        Beside the disclosure rather than inside it. A checkbox within
        `<summary>` inherits its click, so selecting five photographs would
        also expand five forms — and the usual fix, stopping propagation on
        a wrapper, means putting a handler on an element that is not
        interactive. Moving it out removes the conflict instead of working
        around it.
      */}
      {onSelect === undefined ? null : (
        <label className="flex shrink-0 cursor-pointer items-center pl-4 pr-1">
          <input
            aria-label={`Select ${untitled ? "untitled photograph" : photo.title}`}
            checked={selected ?? false}
            className="size-5 cursor-pointer rounded accent-white/80"
            onChange={handleSelect}
            type="checkbox"
          />
        </label>
      )}

      <details className="group min-w-0 flex-1" onToggle={handleToggle}>
        {/*
          `list-none` plus the explicit chevron: the native triangle differs
          on every platform and none of them match this. `min-h-16` keeps the
          whole row a comfortable target rather than only the words in it.
        */}
        <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 p-4 transition-colors hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white/80 [&::-webkit-details-marker]:hidden">
          <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-white/5">
            <Image
              alt=""
              blurDataURL={photo.blur_data_url}
              className="object-cover"
              fill={true}
              placeholder="blur"
              sizes="56px"
              src={photo.blob_url}
            />
          </div>

          <div className="min-w-0 flex-1">
            <p
              className={`truncate font-medium text-[0.9375rem] ${untitled ? "text-white/55 italic" : "text-white"}`}
            >
              {untitled ? "Untitled" : photo.title}
            </p>
            <p className="mt-0.5 truncate text-white/55 text-xs">
              <span>
                {(photo.location ?? "").trim() === ""
                  ? "No location"
                  : photo.location}
              </span>
              <span aria-hidden="true" className="px-1.5 text-white/20">
                /
              </span>
              <span className="tabular-nums">
                {photo.width} × {photo.height}
              </span>
            </p>
          </div>

          <Status photo={photo} />

          <ChevronDown
            aria-hidden="true"
            className="shrink-0 text-white/50 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
            size={16}
          />
        </summary>

        {opened ? (
          <div className="border-white/[0.06] border-t p-5">
            <div className="flex flex-col gap-5 sm:flex-row">
              <div className="sm:w-[200px] sm:shrink-0">
                {/*
                Fixed 4:3 box. Left to its own aspect ratio, a portrait
                original made its row three times taller than a landscape one
                and the list became impossible to scan.
              */}
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-white/5">
                  <Image
                    alt={untitled ? "Uploaded photograph" : photo.title}
                    blurDataURL={photo.blur_data_url}
                    className="object-cover"
                    fill={true}
                    placeholder="blur"
                    sizes="(max-width: 640px) 100vw, 200px"
                    src={photo.blob_url}
                  />
                </div>
                {exif === null ? null : (
                  <p className="mt-2 text-pretty text-white/55 text-xs">
                    {exif}
                  </p>
                )}
              </div>

              <PhotoEditForm photo={photo} />
            </div>
          </div>
        ) : null}
      </details>
    </li>
  );
});
