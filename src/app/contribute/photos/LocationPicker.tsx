"use client";

import { MapPin } from "lucide-react";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { FIELD, LABEL, LABEL_HINT, META } from "@/components/ui/field";
import { GlassButton } from "@/components/ui/glass-button";
import { Notice } from "@/components/ui/Notice";
import { CELL_KM, coarsen, MAX_ERROR_KM } from "@/lib/photos/coarsen";
import type { OwnPhotoRow, Pin } from "@/lib/photos/types";

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

/** Where the map opens when there is nothing to open it on. */
const DEFAULT_CENTRE: Pin = { lat: 20, lng: 0 };
const DEFAULT_ZOOM = 1.2;
const MARKED_ZOOM = 9;

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
function parsePoint(text: string): Pin | null {
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
 * The map itself, mounted only once somebody asks for it.
 *
 * Separate from the picker so the imperative lifecycle — create, move,
 * destroy — is not tangled with the form state. It reports clicks upward and
 * takes the current point downward; the field and the map are two views of
 * one value, and the value lives in the parent.
 */
function MapSurface({
  styleUrl,
  point,
  onPick,
}: {
  styleUrl: string;
  point: Pin | null;
  onPick: (picked: Pin) => void;
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
        The map could not be loaded. Type the coordinates above instead — that
        works exactly the same.
      </Notice>
    );
  }

  return (
    <div
      className="h-72 w-full overflow-hidden rounded-2xl border border-white/[0.08]"
      ref={container}
    />
  );
}

export function LocationPicker({
  photo,
  styleUrl,
}: {
  photo: OwnPhotoRow;
  styleUrl: string | null;
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
    setText(`${picked.lat.toFixed(5)}, ${picked.lng.toFixed(5)}`);
  }, []);

  const typedSomething = text.trim() !== "";

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
        className={FIELD}
        id={`pin-${photo.id}`}
        inputMode="decimal"
        onChange={handleText}
        placeholder="47.3769, 8.5417"
        value={text}
      />

      {typedSomething && point === null ? (
        <Notice tone="warning">
          That does not read as a coordinate. Two numbers, latitude first — for
          example <code>47.3769, 8.5417</code>.
        </Notice>
      ) : null}

      {styleUrl === null ? (
        <Notice tone="warning">
          The map is not available on this deployment, so there is nothing to
          click. Typing the two numbers above does exactly the same thing.
        </Notice>
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

      {/*
        What marking it actually publishes, in both precisions, before the
        save rather than after it. This is the consent — a photographer
        agreeing to "a location" is not agreeing to anything they can check,
        and the two lines below are checkable.
      */}
      {coarse === null ? null : (
        <dl className="space-y-2 rounded-2xl border border-white/[0.08] p-3">
          {publicOnly || point === null ? null : (
            <div>
              <dt className={META}>Exact — members only</dt>
              <dd className="mt-0.5 text-[0.8125rem] text-white/85 tabular-nums">
                {format(point, 5)}
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
      <label
        className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/[0.08] p-3"
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
        <span className="space-y-1">
          <span className="block font-medium text-sm text-white/85">
            Publish the blurred dot only
          </span>
          <span className="block text-[0.75rem] text-white/55 leading-relaxed">
            The exact point is discarded rather than stored, so not even members
            see it. Use this for anything that should not be findable — a nest,
            a rare plant, somewhere people live.
          </span>
        </span>
      </label>
    </div>
  );
}
