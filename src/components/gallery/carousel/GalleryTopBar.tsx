import Link from "next/link";
import { SessionChip } from "@/components/SessionChip";
import { META } from "@/components/ui/field";

/**
 * The only chrome added to the main gallery.
 *
 * `/photographers` is the site's one navigational affordance for a visitor
 * who wonders who made these, or whether they could contribute — without it
 * the gallery is a beautiful dead end. It sits top-right because that is
 * where a contributor page puts its view toggle, so navigation is always in
 * the same corner.
 *
 * `SessionChip` is the second, and exists only for somebody signed in: a
 * photographer had no route from the gallery to their own photographs.
 *
 * **`justify-between` with the chip on the left is what keeps the layout
 * still.** The chip cannot be rendered on the server — this page is
 * statically cached and one document is served to everybody — so it appears
 * after hydration for the people who have a session. Beside `photographers`
 * on the right, its arrival would shove that link sideways on every
 * signed-in visit. On the left, in a slot that is simply empty for everybody
 * else, nothing moves.
 */
export function GalleryTopBar() {
  return (
    <div className="relative z-10 flex items-center justify-between safe-x-4 safe-t-4 sm:safe-x-8 sm:safe-t-5">
      <SessionChip />
      <Link
        className={`${META} inline-flex min-h-11 items-center rounded-full px-3 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80`}
        href="/photographers"
      >
        photographers
      </Link>
    </div>
  );
}
