"use client";

import type { Pin } from "@/lib/photos/types";
import { MapSurface } from "./MapSurface";

/**
 * Pointing at roughly where a photograph was taken, so a model has something
 * to go on.
 *
 * "Somewhere around here" is easier to point at than to spell, and a rough
 * coordinate is the single most useful thing a model can be told about a
 * coastline — every stretch of limestone looks like every other stretch of
 * limestone, and knowing which country's it is turns a guess into a name.
 *
 * **This is not the pin.** Nothing pointed at here is saved, shown to
 * anybody, or drawn on the globe; it does not go near the fields the form
 * submits, and it is deliberately in a different part of the page from the
 * control that does. What it does is travel, once, inside one request — and
 * because that is the only outbound coordinate on this site, it goes at
 * reduced precision. `src/lib/ai/hint.ts` rounds it to about eleven
 * kilometres before it can reach a prompt, which is as much as naming a
 * coast requires and less than a house needs to stay unfound.
 *
 * The surface itself is imported rather than written, which keeps the count
 * of files in this codebase that name a mapping library at one — see I14.
 */

export function HintMap({
  styleUrl,
  near,
  onPick,
}: {
  styleUrl: string;
  near: Pin | null;
  onPick: (picked: Pin) => void;
}) {
  return (
    <div className="space-y-1.5">
      <MapSurface
        height="h-48"
        onPick={onPick}
        point={near}
        styleUrl={styleUrl}
      />
      {/*
        A plain line rather than a `Notice`. Three tones exist on this site
        and none of them is "by the way" — a warning border around a
        statement nobody has to act on would make the quietest sentence on
        the form the loudest thing in it.
      */}
      <p className="text-[0.75rem] text-white/55 leading-relaxed">
        {near === null
          ? "Click the rough area. Nothing here is saved."
          : `Pointing at about ${near.lat.toFixed(1)}, ${near.lng.toFixed(1)} — sent once as a hint, and not saved.`}
      </p>
    </div>
  );
}
