/**
 * What `/api/globe` answers with, and the one fetch that asks.
 *
 * Its own module, and deliberately a very cheap one: `GlobeStage` starts this
 * request the moment the overlay opens, while `GlobeOverlay` — the component
 * that actually renders the data — is still being downloaded. Putting the
 * type and the fetch here lets the page hold both without pulling in the card,
 * `next/image`, or the gesture vocabulary that comes with them.
 *
 * Nothing in this file imports React, and it should stay that way.
 */

export interface GlobePlace {
  key: string;
  label: string;
  count: number;
  /**
   * One photograph from this cell, chosen server-side. `null` where the query
   * found none, which should not happen given both come from the same
   * published set — but a card with no picture is a card, and a crash is not.
   */
  thumb: { url: string; width: number; height: number; bg: string } | null;
  photos: { id: string; title: string }[];
}

/**
 * The places, fetched once per session on the first open.
 *
 * A module-scoped promise for the same reason the coastlines use one: opening
 * the globe a second time is instant, and two globes on one page cannot each
 * ask. The route is CDN-cached for an hour on top of this, so the second
 * reader does not reach the database either.
 */
let placesPromise: Promise<GlobePlace[]> | null = null;

export function loadPlaces(): Promise<GlobePlace[]> {
  placesPromise ??= fetch("/api/globe")
    .then((response) => {
      if (!response.ok) {
        throw new Error(`/api/globe answered ${response.status}`);
      }
      return response.json() as Promise<GlobePlace[]>;
    })
    /*
     * A rejection clears the cache rather than being kept in it.
     *
     * Without this the memo is a trap: one offline open, one 500, one
     * truncated body, and the rejected promise sits at module scope for the
     * life of the page — every later open re-awaits the same failure and the
     * card never works again. The two coastline loaders have the same shape
     * and get away with it, because a reader who wants the coastline back
     * reloads the page; this one is behind a button the same reader will
     * press again in the same session.
     */
    .catch((cause: unknown) => {
      placesPromise = null;
      throw cause;
    });
  return placesPromise;
}
