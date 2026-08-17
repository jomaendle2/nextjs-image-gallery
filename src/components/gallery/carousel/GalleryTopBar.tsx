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
/**
 * One link's worth of styling, three times.
 *
 * `px-2` below `sm` rather than `px-3`: three of these plus the session chip
 * is tight at 390, and the 44px touch floor is held by `min-h-11` and
 * `min-w-11` regardless of the horizontal padding.
 */
const LINK_CLASS = `${META} inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-2 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 sm:px-3`;

export function GalleryTopBar({
  membershipOffered = false,
}: {
  /**
   * Whether membership is on sale, decided on the server and handed down.
   *
   * It cannot be read here. `ImageCarousel` is a `"use client"` component, so
   * this file is in the browser bundle with it — `membershipConfigured()`
   * would read a `process.env` that does not exist there and quietly return
   * false for everybody, which is the worst kind of wrong: a link that is
   * missing in production and present in nobody's tests.
   *
   * Defaulting to false keeps a caller that has not been taught about it from
   * advertising something that may not be for sale.
   */
  membershipOffered?: boolean;
}) {
  return (
    <div className="relative z-10 flex items-center justify-between safe-x-4 safe-t-4 sm:safe-x-8 sm:safe-t-5">
      <SessionChip />
      {/*
        Three destinations rather than one.

        The gallery used to link to `/photographers` and nowhere else, so the
        page every visitor lands on offered no route to the globe, the
        membership, or any statement of what the site is — a friend sent this
        link, looked at photographs, and left without ever being asked
        anything. These are the whole of the site's public navigation and they
        belong on the page that has all the traffic.

        `membership` only when it is actually on sale — the flag arrives as a
        prop for the reason given above it.
      */}
      <nav className="flex items-center gap-0.5 sm:gap-2">
        <Link className={LINK_CLASS} href="/globe">
          globe
        </Link>
        <Link className={LINK_CLASS} href="/photographers">
          photographers
        </Link>
        {membershipOffered ? (
          <Link className={LINK_CLASS} href="/membership">
            membership
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
