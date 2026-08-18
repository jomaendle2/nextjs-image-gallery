"use client";

import { createContext, type ReactNode, useContext } from "react";

/**
 * Whether a membership is actually on sale, for the parts of the carousel
 * that offer one.
 *
 * A context rather than a prop, because of where the consumer sits. The flag
 * is produced by a server page and needed by `MemberDetails`, which is four
 * hops down — `ImageCarousel` → `CaptionBar` → `PhotoCredit` → `PhotoDetails`
 * — and, worse, inside a module-level `body()` helper rather than the
 * component itself. Drilling it would add a forwarded prop to three files
 * whose subject is layout, and a parameter to a helper that is otherwise a
 * pure function of one photograph's data.
 *
 * `GalleryTopBar` and `SiteNav` keep their explicit prop. `SiteNav` renders
 * from several pages that have no carousel around them, so wiring it to this
 * provider would mean adding a provider to each of them for one boolean.
 *
 * `membershipConfigured()` stays on the server. This file is `"use client"`,
 * and reading a Stripe key from a module that ships to the browser is the
 * mistake `GalleryTopBar` documents at its own top.
 */

/**
 * False, deliberately.
 *
 * A subtree rendered without a provider hides an offer rather than inventing
 * one. That is the direction that fails safely: the bug this exists to fix
 * was a teaser advertising a paid tier that led to a page reading "Not open
 * yet", and a missing provider must not be able to recreate it.
 */
const MembershipOfferContext = createContext(false);

export function MembershipOfferProvider({
  children,
  offered,
}: {
  children: ReactNode;
  offered: boolean;
}) {
  return (
    <MembershipOfferContext value={offered}>{children}</MembershipOfferContext>
  );
}

/** Whether this subtree may offer a membership. */
export function useMembershipOffered(): boolean {
  return useContext(MembershipOfferContext);
}
