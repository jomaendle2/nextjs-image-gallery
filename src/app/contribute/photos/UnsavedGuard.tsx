"use client";

import { useEffect, useState } from "react";
import { hasUnsaved, watchUnsaved } from "./unsaved";

/**
 * Stops a half-written caption being thrown away by a reload or a closed tab.
 *
 * The dashboard's text lives in uncontrolled inputs and is saved only when
 * "Save changes" is pressed, so every way of leaving discards it silently.
 * `UploadForm` already guarded the one case somebody had thought about — a
 * batch in flight — while the text a photographer had just typed was not
 * guarded at all.
 *
 * What this does not cover, and why it is a separate job. `beforeunload`
 * fires for a reload, a closed tab, a typed URL and an external link. It does
 * not fire for a Next `<Link>`, which never unloads the document — so the
 * workspace nav above the form is still an unguarded way to lose the work.
 * The obvious fix is to intercept those clicks and ask, but the only thing a
 * click handler can ask with is `confirm`, and this project forbids it
 * (`lint/suspicious/noAlert`) for a good reason: its own answer to "are you
 * sure" is the in-UI two-step the delete button uses, where the question is
 * part of the page rather than a modal the browser drew. Doing that properly
 * means a real control — the same shape as `BulkBar` — and it belongs in its
 * own change rather than smuggled in behind a lint suppression.
 *
 * The listener exists only while something is actually at risk. Registering
 * `beforeunload` unconditionally makes some browsers treat the page as
 * unload-sensitive and drop it from the back/forward cache, which would slow
 * every navigation to pay for a warning nobody needs.
 */
export function UnsavedGuard() {
  const [armed, setArmed] = useState(false);

  useEffect(() => watchUnsaved(() => setArmed(hasUnsaved())), []);

  useEffect(() => {
    if (!armed) {
      return;
    }

    /*
     * `preventDefault` and nothing else. Browsers have ignored custom text
     * here for years and substitute their own wording, so a message would be
     * a string nobody ever reads.
     */
    const hold = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    globalThis.addEventListener("beforeunload", hold);
    return () => {
      globalThis.removeEventListener("beforeunload", hold);
    };
  }, [armed]);

  return null;
}
