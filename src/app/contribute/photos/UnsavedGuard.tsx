"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";
import { GlassButton } from "@/components/ui/glass-button";
import {
  clearPendingExit,
  hasUnsaved,
  pendingExit,
  watchPendingExit,
  watchUnsaved,
} from "./unsaved";

/**
 * Stops a half-written caption being thrown away by a reload or a closed tab.
 *
 * The dashboard's text lives in uncontrolled inputs and is saved only when
 * "Save changes" is pressed, so every way of leaving discards it silently.
 * `UploadForm` already guarded the one case somebody had thought about — a
 * batch in flight — while the text a photographer had just typed was not
 * guarded at all.
 *
 * Two halves, because leaving has two shapes. `beforeunload` fires for a
 * reload, a closed tab, a typed URL and an external link, and there the
 * browser draws the question. It does not fire for a Next `<Link>`, which
 * never unloads the document — so the workspace nav directly above the form
 * was the easiest way in the page to lose the work, one click and no warning.
 * `GuardedLink` cancels that navigation through `onNavigate` and hands the
 * destination here, and the panel below is the question.
 *
 * In the page rather than a `confirm`, which this project forbids
 * (`lint/suspicious/noAlert`) for the reason `BulkBar` demonstrates: its
 * answer to "are you sure" is a two-step where the question is part of the
 * page. Blocking navigation is also exactly what a browser modal is worst at
 * — it steals focus from a form somebody is still mid-sentence in.
 *
 * Still not covered: the wordmark and the footer, which are shared with pages
 * that ship no client JavaScript at all and cannot become client components
 * to gain a guard the rest of the site has no use for. `beforeunload` does
 * not help there either, since those are `<Link>`s too.
 *
 * The listener exists only while something is actually at risk. Registering
 * `beforeunload` unconditionally makes some browsers treat the page as
 * unload-sensitive and drop it from the back/forward cache, which would slow
 * every navigation to pay for a warning nobody needs.
 */
export function UnsavedGuard() {
  const [armed, setArmed] = useState(false);
  const [leaving, setLeaving] = useState<string | null>(null);
  const router = useRouter();
  const titleId = useId();

  useEffect(() => watchUnsaved(() => setArmed(hasUnsaved())), []);
  useEffect(() => watchPendingExit(() => setLeaving(pendingExit())), []);

  const stay = useCallback(() => {
    clearPendingExit();
  }, []);

  /*
   * The rows clear their own ids as they unmount, so nothing has to be reset
   * on the way out — `router.push` is the whole of leaving. Cleared first
   * regardless, so a navigation that is slow to commit does not leave the
   * panel on screen looking like a click that did nothing.
   */
  const leave = useCallback(() => {
    const destination = leaving;
    clearPendingExit();
    if (destination !== null) {
      router.push(destination);
    }
  }, [leaving, router]);

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

  /*
   * Escape agrees with "Stay": the answer that keeps the work.
   *
   * On the document rather than the panel, because the click that opened this
   * came from a link in the header and focus may be anywhere — a handler on
   * the panel would only answer for somebody who had already reached it.
   */
  useEffect(() => {
    if (leaving === null) {
      return;
    }

    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearPendingExit();
      }
    };

    globalThis.addEventListener("keydown", dismiss);
    return () => {
      globalThis.removeEventListener("keydown", dismiss);
    };
  }, [leaving]);

  if (leaving === null) {
    return null;
  }

  return (
    /*
      `alertdialog`, and focus taken deliberately.
      
      This interrupts a decision somebody just made, which is the one case
      where taking focus is right rather than rude — and it is taken by
      "Stay", never by the destructive answer, so a stray Return keeps the
      work. Escape agrees with it.
    */
    <div
      aria-labelledby={titleId}
      aria-modal="false"
      className="fixed inset-x-0 bottom-0 z-[200] flex justify-center safe-x-4 safe-b-4"
      role="alertdialog"
    >
      <div className="glass-thick w-full max-w-md space-y-3 rounded-2xl p-4">
        <p className="text-sm text-white/80" id={titleId}>
          You have changes that have not been saved. Leaving this page discards
          them.
        </p>
        <div className="flex flex-wrap gap-2">
          <GlassButton autoFocus={true} onClick={stay} variant="primary">
            Stay on this page
          </GlassButton>
          <GlassButton onClick={leave} variant="danger">
            Leave without saving
          </GlassButton>
        </div>
      </div>
    </div>
  );
}
