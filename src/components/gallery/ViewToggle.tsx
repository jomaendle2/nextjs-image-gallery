import { LayoutGrid, Rows3 } from "lucide-react";
import Link from "next/link";

/**
 * Grid or carousel, as two links rather than client state.
 *
 * A `?view=` param would read `searchParams` and opt the page out of static
 * rendering — the same trap that made the contributor filter a route segment
 * in the first place. Sibling routes keep both views prerendered, keep both
 * shareable, and avoid a hydration flash from reading the URL on the client.
 */
export function ViewToggle({
  slug,
  view,
}: {
  slug: string;
  view: "grid" | "slideshow";
}) {
  /*
   * 44px square, not the 36x32 this used to be.
   *
   * These two links are the whole navigation between a photographer's two
   * views, they sit in a sticky header, and they were the smallest touch
   * targets on the site — on the pages most likely to be opened on a phone.
   * The rest of the codebase settled this question already: `min-h-11` on
   * the fields, `TOUCH_LINK` on standalone links. A segmented control is not
   * the place to make an exception.
   */
  const base =
    "inline-flex size-11 items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80";
  const on = "bg-white/15 text-white";
  const off = "text-white/40 hover:text-white/80";

  return (
    <div className="glass-hairline inline-flex items-center gap-1 rounded-xl p-1">
      <Link
        aria-current={view === "grid" ? "page" : undefined}
        className={`${base} ${view === "grid" ? on : off}`}
        href={`/by/${slug}`}
      >
        <LayoutGrid aria-hidden="true" size={15} />
        <span className="sr-only">Grid</span>
      </Link>
      <Link
        aria-current={view === "slideshow" ? "page" : undefined}
        className={`${base} ${view === "slideshow" ? on : off}`}
        href={`/by/${slug}/slideshow`}
      >
        <Rows3 aria-hidden="true" size={15} />
        <span className="sr-only">Slideshow</span>
      </Link>
    </div>
  );
}
