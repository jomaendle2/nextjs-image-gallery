import Link from "next/link";
import { navLink } from "@/components/ui/field";

/**
 * The public site's whole navigation, in one list.
 *
 * It existed twice before this file: as three `<Link>`s inside
 * `GalleryTopBar`, and as nothing at all on `/globe` and `/photographers`,
 * which carried a wordmark and a heading. So the two pages a visitor reaches
 * from the gallery were the two with no way to reach each other — landing on
 * `/photographers` from a shared link, the only onward move was the wordmark
 * back to the front page, and the globe was undiscoverable.
 *
 * Naming the sections in one array is also what makes "where am I" answerable:
 * a page says which section it is, and the nav marks it. Nothing derives the
 * current section from `usePathname`, because that would make this a client
 * component and drag it into the bundle of two routes that deliberately ship
 * no client JavaScript at all.
 */
export type PublicSection = "globe" | "photographers" | "membership";

interface Destination {
  section: PublicSection;
  href: string;
  label: string;
}

const DESTINATIONS: readonly Destination[] = [
  { section: "globe", href: "/globe", label: "globe" },
  { section: "photographers", href: "/photographers", label: "photographers" },
  { section: "membership", href: "/membership", label: "membership" },
];

/*
 * Styling lives in `navLink`, beside the other tokens: `WorkspaceNav`
 * renders the same current-vs-idle mark and the two copies had already been
 * written twice here.
 */

export function SiteNav({
  current,
  membershipOffered = false,
  className = "",
}: {
  /**
   * The section this page belongs to, or nothing for a page that is in none
   * of them — the gallery itself, or a legal page.
   */
  current?: PublicSection;
  /**
   * Whether membership is on sale.
   *
   * A prop rather than a `membershipConfigured()` call, because this renders
   * inside `GalleryTopBar`, which is in the carousel's client bundle: reading
   * `process.env` there returns undefined for everybody and would hide the
   * link in production while every test kept passing.
   */
  membershipOffered?: boolean;
  className?: string;
}) {
  return (
    <nav
      aria-label="Sections"
      className={`flex items-center gap-0.5 sm:gap-2 ${className}`}
    >
      {DESTINATIONS.filter(
        (destination) =>
          membershipOffered || destination.section !== "membership",
      ).map((destination) => (
        <Link
          aria-current={destination.section === current ? "page" : undefined}
          className={navLink(
            destination.section === current,
            "min-w-11 justify-center",
          )}
          href={destination.href}
          key={destination.section}
        >
          {destination.label}
        </Link>
      ))}
    </nav>
  );
}
