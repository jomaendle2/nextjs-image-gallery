/**
 * The two shapes the dashboard's photographs come in, and the rule for which
 * one a photographer meets first.
 *
 * Its own file rather than a type beside the component, for the reason
 * `filter.ts` is: three files need the type, one needs the choice, and the
 * choice is a rule worth testing without rendering a grid of images.
 */

/**
 * `list` is a wide bar per photograph — title, location, status, and a 56px
 * thumbnail. `grid` is a tile that is mostly photograph.
 *
 * Not two components and not two pages. They are the same rows with the same
 * selection, the same filter and the same forms; only the closed state
 * differs, and an open one is a wide bar in both.
 */
export type PhotoLayout = "list" | "grid";

export const LAYOUTS: readonly { value: PhotoLayout; label: string }[] = [
  { value: "list", label: "List" },
  { value: "grid", label: "Grid" },
];

/**
 * The one `<ul>`, in whichever shape.
 *
 * One list either way, not two: the rows keep their identity across a toggle,
 * so an open form stays open and React moves no DOM it does not have to.
 *
 * `@xl` and `@3xl` are container queries against the column the list is in,
 * declared by `PhotoList`. The same markup is two across on a phone and four
 * across in the wide right-hand column of a desk monitor, and no viewport
 * breakpoint can describe both — at `xl` the window is wide, but the column
 * inside it may not be.
 *
 * `items-start` matters more than it looks: without it every tile in a row
 * stretches to the tallest, so the one open row in the grid would drag its
 * neighbours to its own height.
 */
export function listClassName(layout: PhotoLayout): string {
  return layout === "grid"
    ? "grid grid-cols-2 items-start gap-3 @xl:grid-cols-3 @3xl:grid-cols-4"
    : "space-y-3";
}

/**
 * Above this many photographs, the grid is what somebody is shown first.
 *
 * The two shapes answer different questions and the number of rows decides
 * which one is being asked. At sixteen photographs the list is better: every
 * title is readable at a glance, the drafts are obvious, and the whole set is
 * one screen. At a hundred and fourteen — a number this page has actually
 * been measured against — the list is nine screens of near-identical bars,
 * and the only way anybody finds the photograph they mean is by recognising
 * it, which is the one thing a 56px thumbnail cannot help with.
 *
 * Forty is where a list stops fitting on a laptop screen at any plausible
 * zoom. It is a threshold rather than a measurement, and it is only a
 * starting position: the toggle is beside the filters and whichever way it is
 * moved, the choice is remembered.
 */
const GRID_FROM = 40;

export function initialLayout(photographs: number): PhotoLayout {
  return photographs > GRID_FROM ? "grid" : "list";
}

/**
 * Where a photographer's own choice is kept.
 *
 * `localStorage` rather than a cookie or a column. A cookie would be sent
 * with every request on the site, including the ones for photographs, to
 * decide something no server renders; a column would make "which way I like
 * to look at my own dashboard" into a fact about an account, synchronised
 * across devices where the right answer is genuinely different — a phone
 * wants the list and the desk wants the grid.
 *
 * The consequence is that the first paint is always the count's default and
 * the stored choice arrives immediately after, on the client. That swap is
 * the price of not having a server read this, and it is paid once per visit.
 */
const REMEMBERED = "photos:layout";

export function rememberedLayout(): PhotoLayout | null {
  try {
    const saved = globalThis.localStorage.getItem(REMEMBERED);
    return saved === "list" || saved === "grid" ? saved : null;
  } catch {
    /*
     * Private windows and blocked storage throw on access rather than
     * returning null. A preference nobody can save is not an error worth
     * showing anybody — the default is a working answer.
     */
    return null;
  }
}

export function rememberLayout(layout: PhotoLayout): void {
  try {
    globalThis.localStorage.setItem(REMEMBERED, layout);
  } catch {
    /* See above. Forgetting is the whole failure. */
  }
}
