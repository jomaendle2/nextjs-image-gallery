"use client";

import { type RefObject, useEffect, useRef } from "react";

/**
 * Put the reader where the answer is, once a form has been replaced by it.
 *
 * Both forms on this site succeed by unmounting themselves: `useActionState`
 * returns `tone: "sent"` and the component returns a confirmation panel
 * instead of the `<form>`. That is the right shape — there is nothing left to
 * fill in — but it drops the focused submit button out of the document, and a
 * browser answers that by moving focus to `<body>`. So somebody who has just
 * pressed Enter on the last field of an application is returned to the very
 * top of the page with no statement of what happened, and has to go looking
 * for the result of their own action. WCAG 2.4.3.
 *
 * Focus rather than a live region, and the difference matters. WCAG 4.1.3
 * governs status messages *that do not receive focus*; a confirmation the
 * reader is moved to is announced by the move itself, so the two mechanisms
 * are alternatives rather than a pair. Doing both makes a screen reader say
 * the heading twice — once as inserted text, once as the newly focused
 * element — which is not thoroughness, it is a stutter. The error path is the
 * case where a live region is the only option, because the form stays where
 * it is and focus should stay with it; that region lives in the form and is
 * mounted for exactly as long as it can have something to say.
 *
 * The element handed the ref wants `tabIndex={-1}`: a heading is not in the
 * tab order and cannot be focused without it, and -1 means "focusable by
 * script, still not a tab stop" — the reader lands here once and tabs onward
 * into the page, rather than finding a heading in their tab sequence forever.
 */
export function useFocusOnSuccess<T extends HTMLElement>(
  succeeded: boolean,
): RefObject<T | null> {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (succeeded) {
      ref.current?.focus();
    }
  }, [succeeded]);

  return ref;
}
