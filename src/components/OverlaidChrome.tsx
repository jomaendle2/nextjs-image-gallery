"use client";

import { useOverlaidChrome } from "@/hooks/useOverlaidChrome";

/**
 * Mounts the measurement once, for the whole document.
 *
 * The hook writes `--chrome-b` on `<html>` and the `safe-b-*` utility reads
 * it, so every bottom-anchored surface on the site depends on it: the
 * carousel's caption, the details sheet, and the unsaved-work bar on the
 * contribute page. Mounting it inside `ImageCarousel` — where the bug was
 * found — would have fixed exactly the surface somebody happened to be
 * looking at and left the others under the same chrome.
 *
 * A component rather than a call, because the root layout is a server
 * component and this needs an effect. It renders nothing.
 */
export function OverlaidChrome(): null {
  useOverlaidChrome();
  return null;
}
