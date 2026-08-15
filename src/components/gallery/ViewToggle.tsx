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
  const base =
    "inline-flex h-8 w-9 items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80";
  const on = "bg-white/15 text-white";
  const off = "text-white/40 hover:text-white/80";

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-white/10 p-1">
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
