"use client";

import { useEffect, useRef, useState } from "react";
import { Notice } from "@/components/ui/Notice";
import type { Pin } from "@/lib/photos/types";

/**
 * The map, as one imperative object with a React shape around it.
 *
 * Its own file because two controls now draw one: the picker below the
 * Location field, where a click sets the coordinate that gets saved, and the
 * hint map beside "Suggest details", where a click sets a rough point that
 * is sent once and never stored. Both need the same thing — a surface that
 * reports clicks upward and takes a point downward — and neither needs to
 * know how the library underneath is loaded.
 *
 * That is also what keeps I14 true at exactly one file. The invariant counts
 * the files in this codebase that name the mapping library and requires the
 * answer to be one, because "which components end up on a public page" is
 * the question a refactor answers differently without telling anybody. A
 * second copy of this loader would have made the answer two; an import makes
 * it stay one.
 */

/** Where the map opens when there is nothing to open it on. */
const DEFAULT_CENTRE: Pin = { lat: 20, lng: 0 };
const DEFAULT_ZOOM = 1.2;
const MARKED_ZOOM = 9;

/**
 * Loading MapLibre with a bare `import()` rather than `next/dynamic`.
 *
 * `next/dynamic` exists to lazily mount a *React component*, and MapLibre is
 * not one — it is an imperative library you hand a DOM node to. Reaching for
 * it here would mean writing a React wrapper whose only purpose is to give
 * `next/dynamic` something to import, and its `ssr: false` would be
 * guarding against a render that cannot happen anyway, because this call
 * sits inside an effect.
 *
 * What matters is what both approaches buy, and this gets it: the library is
 * in its own chunk, fetched when somebody presses the button and never
 * before. `PhotoCard` already mounts the edit form on first open, but that
 * precedent covers *mounting*, not *downloading* — a statically imported
 * MapLibre would sit in the dashboard's chunk whether or not any row was
 * ever expanded.
 */
async function loadMapLibre() {
  const [library] = await Promise.all([
    import("maplibre-gl"),
    /*
     * The stylesheet comes with the chunk rather than the page. MapLibre
     * lays its canvas and controls out in CSS, so without this the map is a
     * pile of absolutely-positioned nothing — and importing it at the top of
     * this file would put it in the dashboard's stylesheet for every
     * contributor who never opens a map.
     */
    import("maplibre-gl/dist/maplibre-gl.css"),
  ]);
  return library;
}

/**
 * The map itself, mounted only once somebody asks for it.
 *
 * Separate from the picker so the imperative lifecycle — create, move,
 * destroy — is not tangled with the form state. It reports clicks upward and
 * takes the current point downward; the field and the map are two views of
 * one value, and the value lives in the parent.
 *
 * Exported for the hint map beside "Suggest details", and exported rather
 * than copied for a reason with a test behind it: I14 counts the files in
 * this codebase that name the map library and requires the answer to be one.
 * A second component that draws a map by importing this one names nothing,
 * so the invariant holds unchanged — and the alternative, a near-identical
 * copy of the loader and the marker, would put the library in two files and
 * two chunks to save one import.
 */
export function MapSurface({
  styleUrl,
  point,
  onPick,
  height = "h-72",
}: {
  styleUrl: string;
  point: Pin | null;
  onPick: (picked: Pin) => void;
  /**
   * The one thing a second caller needs to differ on. A hint map is a glance
   * at a coastline rather than a surface somebody works on, and it sits
   * above a form that is already tall.
   */
  height?: string;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const marker = useRef<{
    setLngLat: (at: [number, number]) => unknown;
  } | null>(null);
  const [failed, setFailed] = useState(false);

  /*
   * The click handler is read through a ref rather than closed over, so a
   * new callback identity from the parent cannot tear the map down and
   * rebuild it. Rebuilding would refetch every tile.
   */
  const pick = useRef(onPick);
  pick.current = onPick;

  const startAt = useRef(point);

  useEffect(() => {
    let cancelled = false;
    let map: { remove: () => void } | null = null;

    loadMapLibre()
      .then((maplibre) => {
        if (cancelled || container.current === null) {
          return;
        }
        const created = new maplibre.Map({
          container: container.current,
          style: styleUrl,
          center: [
            startAt.current?.lng ?? DEFAULT_CENTRE.lng,
            startAt.current?.lat ?? DEFAULT_CENTRE.lat,
          ],
          zoom: startAt.current === null ? DEFAULT_ZOOM : MARKED_ZOOM,
          /*
           * Compact, because MapTiler's and OpenStreetMap's attribution is
           * required and would otherwise take a third of a 288px-tall map.
           * It is still there, and still opens.
           */
          attributionControl: { compact: true },
        });
        map = created;

        /*
         * Our own element rather than MapLibre's default pin, which is a
         * blue SVG with the colour baked in — a hex literal `design.test.ts`
         * would catch, and a colour the viewer's palette has no token for.
         */
        const element = document.createElement("div");
        element.className =
          "size-4 rounded-full border-2 border-white bg-white/40";
        marker.current = new maplibre.Marker({ element })
          .setLngLat([
            startAt.current?.lng ?? DEFAULT_CENTRE.lng,
            startAt.current?.lat ?? DEFAULT_CENTRE.lat,
          ])
          .addTo(created);

        created.on("click", (event: { lngLat: { lat: number; lng: number } }) =>
          pick.current({ lat: event.lngLat.lat, lng: event.lngLat.lng }),
        );
      })
      .catch((cause: unknown) => {
        /*
         * A failed chunk is a failed map, not a failed form. The field above
         * still works, so this says so rather than throwing into the error
         * boundary and taking the photographer's unsaved caption with it.
         */
        console.error("Could not load the map:", cause);
        if (!cancelled) {
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
      map?.remove();
      marker.current = null;
    };
  }, [styleUrl]);

  /* Typing in the field moves the marker; clicking the map fills the field. */
  useEffect(() => {
    if (point !== null) {
      marker.current?.setLngLat([point.lng, point.lat]);
    }
  }, [point]);

  if (failed) {
    return (
      <Notice tone="warning">
        The map could not be loaded. The field above does the same job on its
        own — type it there instead.
      </Notice>
    );
  }

  return (
    <div
      className={`${height} w-full overflow-hidden rounded-2xl border border-white/[0.08]`}
      ref={container}
    />
  );
}
