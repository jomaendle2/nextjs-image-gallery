"use client";

import { ChevronDown, ExternalLink, Pin } from "lucide-react";
import Image from "next/image";
import {
  type ChangeEvent,
  memo,
  type SyntheticEvent,
  useCallback,
  useState,
} from "react";
import { exifLine } from "@/lib/photos/exif-line";
import { photoTitle } from "@/lib/photos/title";
import type { OwnPhotoRow } from "@/lib/photos/types";
import { PhotoEditForm } from "./PhotoEditForm";
import type { PhotoLayout } from "./view";

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
 * even while collapsed, and the disclosure triangle's semantics are announced
 * without any `aria-expanded` of our own.
 *
 * Two shapes, one component. In `list` the summary is a wide bar with a 56px
 * thumbnail; in `grid` it is a tile that is mostly photograph. Opening one is
 * the same act either way, and an open tile becomes the wide bar — see
 * `showing` below.
 */

/** Published, draft, or the one pinned to the front of the gallery. */
function Status({ photo }: { photo: OwnPhotoRow }) {
  if (photo.is_opener) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-caution-fill px-2 py-0.5 font-medium text-[0.6875rem] text-caution uppercase tracking-[0.08em]">
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
    <span className="rounded-full bg-positive-fill px-2 py-0.5 font-medium text-[0.6875rem] text-positive uppercase tracking-[0.08em]">
      Published
    </span>
  );
}

/** The location and the pixel dimensions, under a title, in either shape. */
function SubLine({ photo }: { photo: OwnPhotoRow }) {
  return (
    <p className="mt-0.5 truncate text-white/55 text-xs">
      <span>
        {(photo.location ?? "").trim() === "" ? "No location" : photo.location}
      </span>
      <span aria-hidden="true" className="px-1.5 text-white/20">
        /
      </span>
      <span className="tabular-nums">
        {photo.width} × {photo.height}
      </span>
    </p>
  );
}

/**
 * The wide bar: a thumbnail, the title, the status, a chevron.
 *
 * `list-none` plus the explicit chevron: the native triangle differs on every
 * platform and none of them match this. `min-h-16` keeps the whole row a
 * comfortable target rather than only the words in it.
 */
function RowSummary({
  photo,
  untitled,
}: {
  photo: OwnPhotoRow;
  untitled: boolean;
}) {
  return (
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
          {photoTitle(photo.title)}
        </p>
        <SubLine photo={photo} />
      </div>

      <Status photo={photo} />

      <ChevronDown
        aria-hidden="true"
        className="shrink-0 text-white/50 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
        size={16}
      />
    </summary>
  );
}

/**
 * The tile: mostly photograph, with the words underneath.
 *
 * A fixed 4:3 box, for the reason the open row's preview gives — left to
 * their own aspect ratios, a grid of portraits and landscapes ragged every
 * row and stopped being scannable, which is the only thing a grid is for.
 *
 * The title still shows, and that is what separates this from a contact
 * sheet. Half the work on this page is finding the photograph with no title
 * yet; a grid of pictures alone would hide exactly the rows that need
 * attention.
 */
function TileSummary({
  photo,
  untitled,
}: {
  photo: OwnPhotoRow;
  untitled: boolean;
}) {
  return (
    <summary className="block cursor-pointer list-none transition-colors hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white/80 [&::-webkit-details-marker]:hidden">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-white/5">
        <Image
          alt=""
          blurDataURL={photo.blur_data_url}
          className="object-cover"
          fill={true}
          placeholder="blur"
          /*
            Two to four tiles across a column that is itself at most about
            800px, so 200px is the wide case and 45vw covers the phone. Sized
            rather than left to default, because a grid asks for every
            thumbnail at once and the default would fetch each at the full
            width of the viewport.
          */
          sizes="(min-width: 1280px) 200px, 45vw"
          src={photo.blob_url}
        />
      </div>

      <div className="flex items-start gap-2 p-3">
        <div className="min-w-0 flex-1">
          <p
            className={`truncate font-medium text-[0.9375rem] ${untitled ? "text-white/55 italic" : "text-white"}`}
          >
            {photoTitle(photo.title)}
          </p>
          <SubLine photo={photo} />
        </div>
        <Status photo={photo} />
      </div>
    </summary>
  );
}

/**
 * The tick box, with its label wrapped around it.
 *
 * Beside the disclosure rather than inside it, wherever it is placed: a
 * checkbox within `<summary>` inherits its click, so selecting five
 * photographs would also expand five forms — and the usual fix, stopping
 * propagation on a wrapper, means putting a handler on an element that is not
 * interactive. Moving it out removes the conflict instead of working around
 * it.
 *
 * One component for both shapes, taking its position as a class. The
 * alternative was the same `<input>` written twice with two wrappers, which
 * is how the `aria-label` on one of them drifts from the other.
 */
const ROW_SELECT = "flex shrink-0 cursor-pointer items-center pr-1 pl-4";

/**
 * A tile has no spare width to give a checkbox, so it floats over the
 * photograph on its own dark disc — legible over a pale sky, and clear of the
 * title underneath.
 */
const TILE_SELECT =
  "absolute top-2 left-2 flex size-9 cursor-pointer items-center justify-center rounded-full bg-black/55 backdrop-blur-sm";

function SelectBox({
  className,
  label,
  checked,
  onChange,
}: {
  className: string;
  label: string;
  checked: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className={className}>
      <input
        aria-label={label}
        checked={checked}
        className="size-5 cursor-pointer rounded accent-white/80"
        onChange={onChange}
        type="checkbox"
      />
    </label>
  );
}

/**
 * The way to see the photograph as everybody else sees it.
 *
 * Outside the `<details>` for the same reason the checkbox is: a link inside
 * `<summary>` inherits the summary's click, so opening the photograph would
 * also expand the row. And a plain anchor rather than `TextLink`, because
 * this one wants a new tab — a client-side navigation away from the dashboard
 * discards every half-typed caption on the page, and `TextLink` reserves
 * `target="_blank"` for external addresses.
 *
 * Published rows only, and it decides that itself rather than returning a
 * node the caller has to test for null. There is nothing at `/photo/[id]` for
 * a draft; the route serves published photographs, so the link would be a 404
 * dressed as a preview.
 */
function LiveLink({
  photo,
  untitled,
  floating,
}: {
  photo: OwnPhotoRow;
  untitled: boolean;
  /** Over the photograph, on a tile, rather than beside it in a row. */
  floating: boolean;
}) {
  if (photo.published_at === null) {
    return null;
  }

  const anchor = (
    <a
      aria-label={`Open ${untitled ? "this untitled photograph" : photo.title} on the site`}
      className="flex min-h-11 min-w-11 shrink-0 items-center justify-center px-3 text-white/55 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white/80"
      href={`/photo/${photo.id}`}
      rel="noreferrer"
      target="_blank"
    >
      <ExternalLink aria-hidden="true" size={16} />
    </a>
  );

  return floating ? (
    <div className="absolute top-2 right-2 overflow-hidden rounded-full bg-black/55 backdrop-blur-sm">
      {anchor}
    </div>
  ) : (
    anchor
  );
}

/**
 * The open half of a row: the desktop preview, the exposure line, the form.
 *
 * Extracted because the card grew past the complexity ceiling once the header
 * and the body stopped being siblings in one flex — and because this is the
 * part that only exists some of the time, which is exactly the seam a reader
 * wants.
 */
function OpenRow({
  photo,
  exif,
  untitled,
  mapStyleUrl,
  aiOffered,
}: {
  photo: OwnPhotoRow;
  exif: string | null;
  untitled: boolean;
  mapStyleUrl: string | null;
  aiOffered: boolean;
}) {
  return (
    <div className="border-white/[0.06] border-t p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
        {/*
              The preview is a desktop affordance and always was.

              On a phone it rendered a full-width 4:3 crop — about 260px of
              scrolling — directly beneath a summary already showing a 56px
              thumbnail of the same photograph, so the reader met the picture
              twice before reaching the first field. From `sm` up it sits
              beside the form and costs nothing, which is where it earns its
              place.

              Fixed 4:3 box there. Left to its own aspect ratio, a portrait
              original made its row three times taller than a landscape one
              and the list became impossible to scan.
            */}
        <div className="hidden sm:block sm:w-[200px] sm:shrink-0">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-white/5">
            <Image
              alt={untitled ? "Uploaded photograph" : photo.title}
              blurDataURL={photo.blur_data_url}
              className="object-cover"
              fill={true}
              placeholder="blur"
              sizes="200px"
              src={photo.blob_url}
            />
          </div>
          {exif === null ? null : (
            <p className="mt-2 text-pretty text-white/55 text-xs">{exif}</p>
          )}
        </div>

        {/*
              The exposure line still shows on a phone — it is three lines of
              fact about the photograph and the only place a contributor sees
              what the file said. It is the picture that was redundant, not
              this.
            */}
        {exif === null ? null : (
          <p className="text-pretty text-white/55 text-xs sm:hidden">{exif}</p>
        )}

        <PhotoEditForm
          aiOffered={aiOffered}
          mapStyleUrl={mapStyleUrl}
          photo={photo}
        />
      </div>
    </div>
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
 * `memo` is the other half. All four props are stable: `photo` comes from
 * the server-rendered array, `onSelect` is stabilised upstream, `selected`
 * and `aiOffered` are booleans, `layout` is one of two strings. So a
 * keystroke now re-renders the input and nothing else, and ticking one row
 * re-renders one row.
 *
 * Safe with the edit form inside because its inputs are uncontrolled
 * (`defaultValue`), so a skipped render cannot strand typed text.
 */
export const PhotoCard = memo(function PhotoCardRow({
  photo,
  selected,
  onSelect,
  mapStyleUrl,
  aiOffered,
  layout,
}: {
  photo: OwnPhotoRow;
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
  /** A stable string for the life of the page, so `memo` still holds. */
  mapStyleUrl: string | null;
  /** A boolean read on the server; stable for the same reason. */
  aiOffered: boolean;
  /** Which shape this row takes while it is closed. */
  layout: PhotoLayout;
}) {
  const exif = exifLine(photo.exif);
  const untitled = photo.title.trim() === "";

  /*
   * Two pieces of state for one disclosure, and they are genuinely different
   * questions: has this form ever been opened, and is it open now.
   *
   * **Mounted on first open, and kept.** `<details>` hides its children; it
   * does not stop them rendering. So collapsing fixed the list visually and
   * left every row still shipping a complete edit form — measured at 114
   * photographs: 1,374 inputs in the DOM with nothing open, and 1.7 MB of
   * HTML for a page showing 114 one-line rows.
   *
   * The cost of this is a real trade rather than a free win: a form that
   * only exists after JavaScript runs cannot be submitted without it. On
   * balance 1.7 MB over hotel wifi is the worse failure, and it is one
   * everybody pays rather than a few. The summary still renders server-side
   * for every row.
   *
   * **Hidden rather than unmounted when it closes,** so a half-typed caption
   * survives collapsing the row by accident. That is what `opened` alone was
   * meant to achieve and did not: it was only ever set to `true`, and the
   * body sits outside the `<details>` element — which is the only thing that
   * hides anything — so a closed row went on showing its whole open form
   * with the chevron pointing the wrong way. The row could not be collapsed
   * at all. `showing` follows the element's real `open` property, and
   * `hidden` does the hiding that `<details>` cannot do from out here.
   */
  const [opened, setOpened] = useState(false);
  const [showing, setShowing] = useState(false);

  const handleToggle = useCallback(
    (event: SyntheticEvent<HTMLDetailsElement>) => {
      const isOpen = event.currentTarget.open;
      setShowing(isOpen);
      if (isOpen) {
        setOpened(true);
      }
    },
    [],
  );

  /* Stable, so ticking one box does not re-render every other row. */
  const handleSelect = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      onSelect?.(photo.id, event.target.checked),
    [onSelect, photo.id],
  );

  /*
   * An open tile stops being a tile.
   *
   * The form is 200px of preview and two fieldsets; inside a quarter-width
   * grid cell it would be a column of one-word lines, and the grid around it
   * would ragged into a stack of unequal cells. So opening a tile turns it
   * into the same wide bar the list shows, spanning every column — the grid
   * is for finding the photograph, and the row is for working on it.
   */
  const asTile = layout === "grid" && !showing;
  const spansRow = layout === "grid" && showing;

  const selectBox =
    onSelect === undefined ? null : (
      <SelectBox
        checked={selected ?? false}
        className={asTile ? TILE_SELECT : ROW_SELECT}
        label={`Select ${untitled ? "untitled photograph" : photo.title}`}
        onChange={handleSelect}
      />
    );

  return (
    <li
      className={`glass-thin overflow-hidden rounded-3xl ${spansRow ? "col-span-full" : ""}`}
    >
      {asTile ? (
        /*
          Stacked rather than in a row, because a tile has no spare width to
          give a checkbox and a link. They float over the photograph instead,
          each on its own dark disc so it stays legible over a pale sky.

          Still siblings of the `<details>` rather than children of the
          `<summary>`, which is the same rule the wide bar follows below and
          for the same reason: anything clickable inside a `<summary>`
          inherits the summary's click, so ticking a box would also open a
          form.
        */
        <div className="relative">
          <details className="group" onToggle={handleToggle} open={showing}>
            <TileSummary photo={photo} untitled={untitled} />
          </details>

          {selectBox}

          <LiveLink floating={true} photo={photo} untitled={untitled} />
        </div>
      ) : (
        /*
          A column, not a row — and that is the whole of the mobile fix.

          The card used to be one horizontal flex: the select checkbox, the
          `<details>`, and the "see it live" link. Both of those siblings are
          `shrink-0`, so while a form was open they went on stealing about
          84px of a 342px card for as long as it stayed open. Add the body's
          own padding, then the members-only fieldset's, then the nested boxes
          inside that, and helper text ended up in a 166px column — around 22
          characters a line, which turns a 190-character sentence into eight.

          Now the three of them share a header row and the body sits
          underneath at the card's full width.
        */
        <div className="flex items-stretch">
          {selectBox}

          <details
            className="group min-w-0 flex-1"
            onToggle={handleToggle}
            open={showing}
          >
            <RowSummary photo={photo} untitled={untitled} />
          </details>

          <LiveLink floating={false} photo={photo} untitled={untitled} />
        </div>
      )}

      {opened ? (
        <div hidden={!showing}>
          <OpenRow
            aiOffered={aiOffered}
            exif={exif}
            mapStyleUrl={mapStyleUrl}
            photo={photo}
            untitled={untitled}
          />
        </div>
      ) : null}
    </li>
  );
});
