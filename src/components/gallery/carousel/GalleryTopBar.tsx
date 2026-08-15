import Link from "next/link";

/**
 * The only chrome added to the main gallery.
 *
 * `/photographers` is the site's one navigational affordance for a visitor
 * who wonders who made these, or whether they could contribute — without it
 * the gallery is a beautiful dead end. It sits top-right because that is
 * where a contributor page puts its view toggle, so navigation is always in
 * the same corner.
 */
export function GalleryTopBar() {
  return (
    <div className="relative z-10 flex justify-end safe-x-4 safe-t-4 sm:safe-x-8 sm:safe-t-5">
      <Link
        className="inline-flex min-h-11 items-center rounded-full px-3 text-[0.6875rem] text-white/45 uppercase tracking-[0.14em] transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
        href="/photographers"
      >
        photographers
      </Link>
    </div>
  );
}
