import { SessionChip } from "@/components/SessionChip";
import { SiteNav } from "@/components/ui/SiteNav";

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
 * **`ml-auto` on the nav, not `justify-between` on the row, is what keeps the
 * layout still.** The chip cannot be rendered on the server — this page is
 * statically cached and one document is served to everybody — so it appears
 * after hydration for the people who have a session. Beside `photographers`
 * on the right, its arrival would shove that link sideways on every
 * signed-in visit. On the left, in a slot that is simply empty for everybody
 * else, nothing moves.
 *
 * `justify-between` used to do this, and it was wrong for the visitor who has
 * no session: `SessionChip` renders `null` for them, and `justify-between`
 * with a single child leaves that child hard against the left edge. Anonymous
 * visitors — nearly all of them — got the navigation in the wrong corner.
 * `ml-auto` pins the nav right whether or not the chip is ever there.
 */
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
    <div className="relative z-10 flex items-center safe-x-4 safe-t-4 sm:safe-x-8 sm:safe-t-5">
      <SessionChip />
      {/*
        Three destinations rather than one.

        The gallery used to link to `/photographers` and nowhere else, so the
        page every visitor lands on offered no route to the globe, the
        membership, or any statement of what the site is — a friend sent this
        link, looked at photographs, and left without ever being asked
        anything. These are the whole of the site's public navigation and they
        belong on the page that has all the traffic.

        No `current`: the gallery is not one of the three, so nothing is
        marked here. `membership` only when it is actually on sale — the flag
        arrives as a prop for the reason given above it.
      */}
      <SiteNav className="ml-auto" membershipOffered={membershipOffered} />
    </div>
  );
}
