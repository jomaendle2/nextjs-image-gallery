import { navLink } from "@/components/ui/field";
import { GuardedLink } from "./photos/GuardedLink";

/**
 * Where you can go while signed in, and which of those places you are.
 *
 * The workspace had a breadcrumb — `jo mändle / your photographs` — which
 * answers "how do I get out" and "how do I go back one", but never "what else
 * is there". The three destinations were instead a row of prose links on the
 * dashboard *only*, so from `/contribute/invite` the only way to reach
 * `/contribute/admin` was to go back to the dashboard and read the row again.
 * Two pages deep, the site forgot it had other pages.
 *
 * Deliberately **not** the public `SiteNav`. A signed-in photographer captioning
 * an evening's uploads is not shopping for a membership, and putting the
 * gallery's marketing links in a working surface is how an admin panel starts
 * feeling like a different product. The two zones get two navs; the wordmark
 * above this one is the door between them.
 *
 * `GuardedLink` rather than `Link`, for the one route under this nav that can
 * hold unsaved text. The dashboard's captions live in uncontrolled inputs
 * until "Save changes" is pressed, and this nav sits directly above them —
 * which made it the cheapest way in the whole page to discard ten minutes of
 * work. Off that page the guard costs a `hasUnsaved()` call that answers
 * false, which is why it is on all three rather than threaded through as a
 * prop only `/photos` sets.
 */
export type WorkspaceSection = "photographs" | "invite" | "contributors";

interface Destination {
  section: WorkspaceSection;
  href: string;
  label: string;
  /** Owner-only, because the page itself refuses anybody else. */
  ownerOnly?: boolean;
}

const DESTINATIONS: readonly Destination[] = [
  { section: "photographs", href: "/contribute/photos", label: "photographs" },
  { section: "invite", href: "/contribute/invite", label: "invite" },
  {
    section: "contributors",
    href: "/contribute/admin",
    label: "contributors",
    ownerOnly: true,
  },
];

/* Styling lives in `navLink`; `SiteNav` draws the same mark. */

export function WorkspaceNav({
  current,
  owner,
}: {
  current: WorkspaceSection;
  owner: boolean;
}) {
  return (
    /*
      `-ml-2` pulls the first item's own padding back so the words line up with
      the breadcrumb above and the heading below. The padding has to stay: it
      is what holds the 44px touch target.
    */
    <nav aria-label="Your workspace" className="-ml-2 mt-2 flex flex-wrap">
      {DESTINATIONS.filter(
        (destination) => owner || destination.ownerOnly !== true,
      ).map((destination) => (
        <GuardedLink
          aria-current={destination.section === current ? "page" : undefined}
          className={navLink(destination.section === current)}
          href={destination.href}
          key={destination.section}
        >
          {destination.label}
        </GuardedLink>
      ))}
    </nav>
  );
}
