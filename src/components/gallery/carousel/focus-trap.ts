/**
 * Candidates for Tab inside an open dialog — a first pass, not the answer.
 *
 * The `[tabindex="-1"]` clause here excludes only elements whose *sole*
 * claim to focus is a tabindex. It does nothing for a `<button>` that has
 * been given `tabIndex={-1}`, because such a button still matches
 * `button:not([disabled])` on the line above. The viewer has exactly that:
 * a full-screen backdrop button, deliberately out of the tab order, which
 * an earlier version of this file put in the cycle twice over — verified by
 * the Shift+Tab still escaping once. The real exclusion is the `tabIndex`
 * check in `trapTab`.
 */
const FOCUSABLE = [
  "a[href]",
  // biome-ignore-start lint/security/noSecrets: CSS selectors, not keys
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
  // biome-ignore-end lint/security/noSecrets: CSS selectors, not keys
].join(",");

/**
 * Keeps Tab inside `dialog`, and returns whether it had to intervene.
 *
 * `aria-modal` tells a screen reader to ignore everything behind a dialog,
 * but it has no effect whatsoever on the tab order — so without this, a
 * keyboard user tabs out of the viewer and into the gallery behind a blurred
 * backdrop, with nothing on screen to say focus has left. Measured in the
 * full-screen viewer before this existed: nine of twelve tab stops were
 * outside the dialog, the fourth press landing on a navigation link.
 *
 * Returns false when there is nothing focusable to trap, so the caller can
 * leave the event alone rather than swallowing Tab entirely.
 */
export function trapTab(dialog: HTMLElement, event: KeyboardEvent): boolean {
  const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) =>
      // The property, not the attribute: this is what actually decides
      // whether Tab will stop somewhere, and it catches the elements the
      // selector above cannot — a button explicitly removed from the order.
      element.tabIndex >= 0 &&
      // `getClientRects` rather than `offsetParent`, which is null for every
      // descendant of a fixed-position dialog and would filter out all of them.
      element.getClientRects().length > 0,
  );

  const [first] = focusable;
  const last = focusable.at(-1);
  if (!(first && last)) {
    return false;
  }

  const active = document.activeElement;
  const escaped = !dialog.contains(active);
  const atEdge = event.shiftKey ? active === first : active === last;

  if (!(escaped || atEdge)) {
    return false;
  }

  // Wrapping backwards lands on the last control, forwards on the first.
  // Focus that has already escaped — after a click on the backdrop, say — is
  // pulled back to the same edge it would have wrapped to.
  (event.shiftKey ? last : first).focus();
  return true;
}
