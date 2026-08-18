"use client";

import { MapPin } from "lucide-react";
import { type ChangeEvent, useCallback, useEffect, useState } from "react";
import { FIELD, LABEL, LABEL_HINT, META } from "@/components/ui/field";
import { GlassButton } from "@/components/ui/glass-button";
import { Notice } from "@/components/ui/Notice";
import { CELL_KM, coarsen, MAX_ERROR_KM } from "@/lib/photos/coarsen";
import type { OwnPhotoRow, Pin } from "@/lib/photos/types";
import { MapSurface } from "./MapSurface";
import { Why } from "./Why";

/**
 * Marking the spot, and being shown exactly what marking it publishes.
 *
 * **The text field is the feature; the map is an affordance over it.**
 * Typing `47.3769, 8.5417` works with no key configured, no third party
 * contacted, no chunk downloaded and no JavaScript beyond this component —
 * so a failed dynamic import degrades to a working form rather than a dead
 * button, and a photographer on a phone in a field is not asked to pull
 * 230 KB of map library over a bad connection to do a thing they could type.
 *
 * The promise this gallery makes is untouched by any of it: nothing is read
 * from the image file. `derive.ts` still never opens the GPS block. A person
 * dropping a pin is doing the same thing as typing "the pull-off below the
 * second switchback" in the field above — deciding, after the fact, to say
 * where they stood.
 *
 * **No Geolocation API.** `next.config.ts` sends `geolocation=()` on every
 * response, and the premise of the site is that it does not learn where you
 * are. A "use my location" button would be the obvious convenience and it is
 * the one thing this control must never do; this paragraph is here so nobody
 * adds it as a kindness.
 */

/**
 * Reads a coordinate a person typed.
 *
 * Deliberately forgiving about everything except the two numbers: people
 * paste from Google Maps, from a GPS unit, from another photographer's
 * message, and every one of those uses different punctuation. What it will
 * not do is guess — one number, or three, is a refusal rather than an
 * assumption, because assuming here means publishing a dot somewhere nobody
 * chose.
 */
export function parsePoint(text: string): Pin | null {
  const numbers = text.match(/-?\d+(?:\.\d+)?/g);
  if (numbers === null || numbers.length !== 2) {
    return null;
  }
  const [first, second] = numbers;
  const lat = Number(first);
  const lng = Number(second);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }
  return { lat, lng };
}

/**
 * A point as the field spells it, which is the plainest possible form.
 *
 * No fixed precision here: the field's value is what gets saved, and padding
 * an approximate point out to five decimals would dress a guess up as a
 * survey. Rounding, where it is wanted, is a decision about the *source* —
 * a map click is rounded before it is formatted, a coordinate somebody was
 * offered is not lengthened.
 */
export function pointText(point: Pin): string {
  return `${point.lat}, ${point.lng}`;
}

/** How many decimals a click on the map is worth. About a metre. */
const CLICK_PLACES = 5;

function format(point: Pin, places: number): string {
  const ns = point.lat >= 0 ? "N" : "S";
  const ew = point.lng >= 0 ? "E" : "W";
  return `${Math.abs(point.lat).toFixed(places)}° ${ns}, ${Math.abs(point.lng).toFixed(places)}° ${ew}`;
}

/** What the row already has, as text for the field. */
function initialText(photo: OwnPhotoRow): string {
  if (photo.precise_lat !== null && photo.precise_lng !== null) {
    return `${photo.precise_lat}, ${photo.precise_lng}`;
  }
  /*
   * A photographer who chose the public dot only has no exact pair stored,
   * so the cell centre is all there is to show them. Re-saving it is stable:
   * the centre of a cell lies in that cell, so coarsening it again returns
   * the same point rather than drifting one cell per save.
   */
  if (photo.coarse_lat !== null && photo.coarse_lng !== null) {
    return `${photo.coarse_lat}, ${photo.coarse_lng}`;
  }
  return "";
}

/**
 * Which complaint about this field the input should point at, if either.
 *
 * The local one wins. If the text does not parse there is no pin to send, so a
 * server complaint about the pin is necessarily about an earlier submission —
 * and pointing at a message the person has already replaced is worse than
 * pointing at nothing.
 */
function objection(
  unreadable: boolean,
  problemId: string,
  invalid: boolean,
  messageId: string | undefined,
): string | undefined {
  if (unreadable) {
    return problemId;
  }
  return invalid ? messageId : undefined;
}

/**
 * What marking it actually publishes, in both precisions, before the save
 * rather than after it.
 *
 * This is the consent. A photographer agreeing to "a location" is not agreeing
 * to anything they can check, and the two lines below are checkable.
 *
 * `exact` is null both when there is nothing typed and when the photographer
 * chose to publish only the blurred dot — from here those are the same thing,
 * which is the point: the panel shows what will be stored, and in both cases
 * what will be stored is one point rather than two.
 */
function WhatGetsPublished({
  exact,
  coarse,
}: {
  exact: Pin | null;
  coarse: Pin;
}) {
  return (
    <dl className="space-y-2 rounded-2xl border border-white/[0.08] p-3">
      {exact === null ? null : (
        <div>
          <dt className={META}>Exact — members only</dt>
          <dd className="mt-0.5 text-[0.8125rem] text-white/85 tabular-nums">
            {format(exact, 5)}
          </dd>
        </div>
      )}
      <div>
        <dt className={META}>Public — everyone</dt>
        <dd className="mt-0.5 text-[0.8125rem] text-white/85 tabular-nums">
          {format(coarse, 1)}
        </dd>
        <dd className="mt-1 text-[0.75rem] text-white/55 leading-relaxed">
          The middle of a square about {CELL_KM} km across, never more than{" "}
          {MAX_ERROR_KM} km from where you stood. This is the dot the globe
          draws, and anybody can see it.
        </dd>
      </div>
    </dl>
  );
}

export function LocationPicker({
  photo,
  styleUrl,
  invalid = false,
  messageId,
  proposed = null,
}: {
  photo: OwnPhotoRow;
  styleUrl: string | null;
  /**
   * Set when the last save was refused because of this field. The sentence
   * itself is the form's, at `messageId` — the server's complaint and the
   * browser's are two different objections and only one of them can be true
   * at a time, so they are not merged into one string.
   */
  invalid?: boolean;
  /** Where the form's own message is, for `aria-describedby`. */
  messageId?: string;
  /**
   * A coordinate the photographer accepted elsewhere on this form, or the
   * text Undo is putting back.
   *
   * Null and absent both mean "nobody has offered anything"; a new object
   * means "apply this now", and only its identity is checked.
   */
  proposed?: { text: string; at: number } | null;
}) {
  const [text, setText] = useState(() => initialText(photo));
  const [publicOnly, setPublicOnly] = useState(
    () => photo.coarse_lat !== null && photo.precise_lat === null,
  );
  const [mapOpen, setMapOpen] = useState(false);

  const point = parsePoint(text);
  const coarse = point === null ? null : coarsen(point.lat, point.lng);

  const handleText = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setText(event.target.value),
    [],
  );
  const handlePublicOnly = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      setPublicOnly(event.target.checked),
    [],
  );
  const openMap = useCallback(() => setMapOpen(true), []);
  const handlePick = useCallback((picked: Pin) => {
    setText(
      pointText({
        lat: Number(picked.lat.toFixed(CLICK_PLACES)),
        lng: Number(picked.lng.toFixed(CLICK_PLACES)),
      }),
    );
  }, []);

  /*
   * A point offered from somewhere else on the form, applied here.
   *
   * The prop is an object with a stamp on it rather than a bare point, and
   * the stamp is the whole mechanism: accepting the same chip twice would
   * otherwise hand this effect a `===`-equal value and nothing would happen
   * the second time. Identity is the signal; the contents are the payload.
   *
   * A prop rather than the two alternatives. Lifting `text` into the form
   * would spread this component's parsing and formatting rules across two
   * files for the sake of one caller, and an imperative handle would be a
   * ref-based side channel for something that is plainly a value flowing
   * down. The map opens with it, because a pin somebody cannot see has not
   * been shown to them — but only when there is a pin: an Undo that empties
   * this field must not open a map to display nothing.
   */
  useEffect(() => {
    if (proposed === null || proposed === undefined) {
      return;
    }
    setText(proposed.text);
    if (styleUrl !== null && parsePoint(proposed.text) !== null) {
      setMapOpen(true);
    }
  }, [proposed, styleUrl]);

  const typedSomething = text.trim() !== "";
  /*
   * Two numbers were typed and they are not two numbers.
   *
   * This sentence used to sit beside the field with no relationship to it at
   * all: no `aria-invalid`, no `aria-describedby`, nothing tying the warning
   * to the input it is about. Somebody hearing the page was told a coordinate
   * did not parse and left to work out which of eight fields that was. The
   * two attributes below are the whole fix, and they are WCAG 3.3.1.
   */
  const unreadable = typedSomething && point === null;
  const problemId = `pin-problem-${photo.id}`;
  const describedBy = objection(unreadable, problemId, invalid, messageId);

  return (
    <div className="space-y-2.5">
      <label className={LABEL} htmlFor={`pin-${photo.id}`}>
        Mark the spot <span className={LABEL_HINT}>(optional)</span>
      </label>

      {/*
        The two fields the server actually reads, kept controlled so the
        surrounding uncontrolled form receives a parsed pair rather than
        whatever punctuation somebody typed. Empty when the text does not
        parse, which the action reads as "no pin" — and an unparseable
        entry is reported below rather than silently dropped.
      */}
      <input
        name="precise_lat"
        type="hidden"
        value={point === null ? "" : String(point.lat)}
      />
      <input
        name="precise_lng"
        type="hidden"
        value={point === null ? "" : String(point.lng)}
      />

      <input
        aria-describedby={describedBy}
        aria-invalid={unreadable || invalid}
        className={FIELD}
        id={`pin-${photo.id}`}
        inputMode="decimal"
        onChange={handleText}
        placeholder="47.3769, 8.5417"
        value={text}
      />

      {unreadable ? (
        <div id={problemId}>
          <Notice tone="warning">
            That does not read as a coordinate. Two numbers, latitude first —
            for example <code>47.3769, 8.5417</code>.
          </Notice>
        </div>
      ) : null}

      {styleUrl === null ? (
        /*
          A plain line rather than a `Notice`, following `HintMap`: three
          tones exist on this site and none of them is "by the way". A
          warning border made the permanent state of an optional field the
          loudest thing on the form, in engineer language — "this deployment"
          is not a fact about the photographer or about their photograph, and
          there is nothing here for them to do about it.
        */
        <p className="text-[0.75rem] text-white/55 leading-relaxed">
          No map here — typing the two numbers above does exactly the same
          thing.
        </p>
      ) : (
        <>
          {mapOpen ? null : (
            <GlassButton onClick={openMap} size="sm" type="button">
              <MapPin aria-hidden="true" className="mr-1.5" size={14} />
              Mark it on a map
            </GlassButton>
          )}
          {mapOpen ? (
            <MapSurface onPick={handlePick} point={point} styleUrl={styleUrl} />
          ) : null}
        </>
      )}

      {coarse === null ? null : (
        <WhatGetsPublished coarse={coarse} exact={publicOnly ? null : point} />
      )}

      {/*
        The option for a photograph of something that should not be findable.

        A nest, a rare plant, a garden somebody lives in. The established norm
        in wildlife photography is not to publish coordinates at all, and a
        member-only coordinate is still a coordinate given to strangers. This
        writes the public dot and leaves the exact point unstored, so the
        photograph joins the globe and there is nothing behind the paywall to
        leak — one branch in the action rather than a column.
      */}
      <div className="space-y-1.5 rounded-xl border border-white/[0.08] p-3">
        <label
          className="flex cursor-pointer items-start gap-3"
          htmlFor={`pin-public-${photo.id}`}
        >
          <input
            checked={publicOnly}
            className="mt-0.5 size-4 flex-shrink-0 accent-white"
            id={`pin-public-${photo.id}`}
            name="pin_public_only"
            onChange={handlePublicOnly}
            type="checkbox"
          />
          <span>
            <span className="block font-medium text-sm text-white/85">
              Publish the blurred dot only
            </span>
            {/*
              What ticking it does stays on screen. The examples and the
              reasoning fold — this is a consent, and a consent whose
              consequence needs a click is not consent.
            */}
            <span className="mt-0.5 block text-[0.75rem] text-white/55 leading-relaxed">
              The exact point is discarded, so not even members see it.
            </span>
          </span>
        </label>
        <Why summary="Use it for anything that should not be findable.">
          A nest, a rare plant, a garden somebody lives in. The established norm
          in wildlife photography is not to publish coordinates at all, and a
          member-only coordinate is still a coordinate given to strangers. This
          writes the public dot and leaves the exact point unstored, so the
          photograph joins the globe and there is nothing behind the paywall to
          leak.
        </Why>
      </div>
    </div>
  );
}
