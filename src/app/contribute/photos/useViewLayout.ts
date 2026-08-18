"use client";

import { type ChangeEvent, useCallback, useEffect, useState } from "react";
import {
  initialLayout,
  type PhotoLayout,
  rememberedLayout,
  rememberLayout,
} from "./view";

/**
 * Which shape the rows take, and where that answer comes from.
 *
 * Three sources in order, which is the whole of the logic and the reason it
 * is not three lines inside `PhotoList`: how many photographs there are
 * decides the first paint, what this browser remembers overrides it a tick
 * later, and what the photographer presses overrides both and is written
 * down.
 *
 * The first of those has to be a pure function of props. `rememberedLayout()`
 * reads `localStorage`, which does not exist on the server, so seeding state
 * with it would render one thing on the server and another in the browser —
 * a hydration mismatch, and React resolves those by keeping the server's
 * markup, so the preference would appear to be ignored at random. The effect
 * is the correct place for it, and the swap it causes is the ordinary price
 * of a setting the server does not know about.
 */
export function useViewLayout(photographs: number): {
  layout: PhotoLayout;
  onLayoutChange: (event: ChangeEvent<HTMLFieldSetElement>) => void;
} {
  const [layout, setLayout] = useState<PhotoLayout>(() =>
    initialLayout(photographs),
  );

  /*
   * Once, on mount, and deliberately not keyed to `photographs`. The count
   * seeds the default; it does not get to overrule a choice somebody made
   * because they published one more photograph.
   */
  useEffect(() => {
    const saved = rememberedLayout();
    if (saved !== null) {
      setLayout(saved);
    }
  }, []);

  /*
   * One handler on the group rather than a closure per radio, matching
   * `PhotoFilters`. The value is read off the event, which is what a native
   * radio group gives us for free.
   */
  const onLayoutChange = useCallback(
    (event: ChangeEvent<HTMLFieldSetElement>) => {
      const target = event.target as unknown as HTMLInputElement;
      const chosen = target.value as PhotoLayout;
      setLayout(chosen);
      rememberLayout(chosen);
    },
    [],
  );

  return { layout, onLayoutChange };
}
