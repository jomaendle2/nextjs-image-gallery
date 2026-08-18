"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { META } from "@/components/ui/field";

/**
 * The way back to your own things, from anywhere on the public site.
 *
 * A signed-in photographer had no route to their photographs except typing
 * `/contribute` — the gallery, the globe, a photographer's page and the legal
 * pages linked to it from nowhere. So the person most invested in the site was
 * the one it gave the least navigation to.
 *
 * **Fetched after hydration, not rendered from the session.** Every page this
 * appears on is statically cached and serves one document to everybody; a
 * server component reading the cookie here would make the front page dynamic
 * for every anonymous visitor. `MemberDetails` makes the same trade for the
 * same reason, and `/api/me` says so at its own top.
 *
 * **A plain `fetch`, deliberately, not React Query.** The query client lives
 * only in the two layouts that mount the carousel — it was pushed down there
 * so `/globe` and the legal pages would stop shipping it — and this chip wants
 * to appear on those pages too. Reaching for `useQuery` here would either drag
 * the client back onto every page or make the chip mysteriously absent on half
 * of them.
 *
 * **Module scope for the answer**, so it survives a navigation and is asked
 * once per tab rather than once per page. Same lifetime and same reasoning as
 * `sessionIsMember` in `MemberDetails`.
 */
interface Identity {
  contributor: { slug: string; display_name: string } | null;
  member: { active: boolean } | null;
}

/**
 * `undefined` while nobody has asked yet, `null` once we know there is nobody.
 * The distinction is what keeps the chip from flashing in and out.
 */
let known: Identity | null | undefined;
let asking: Promise<Identity | null> | null = null;

function whoAmI(): Promise<Identity | null> {
  asking ??= fetch("/api/me")
    .then((response) =>
      response.ok ? (response.json() as Promise<Identity>) : null,
    )
    .then((identity) => {
      known = identity;
      return identity;
    })
    .catch(() => {
      /*
       * A chip is not worth an error boundary. Failing quietly leaves the page
       * exactly as it was before this component existed, which is a page that
       * works.
       */
      known = null;
      asking = null;
      return null;
    });
  return asking;
}

/** The first letter of a name, which is all the room there is. */
function initial(name: string): string {
  return [...name.trim()][0]?.toUpperCase() ?? "?";
}

export function SessionChip() {
  const [identity, setIdentity] = useState<Identity | null | undefined>(known);

  useEffect(() => {
    if (known !== undefined) {
      setIdentity(known);
      return;
    }
    let live = true;
    whoAmI().then((answer) => {
      if (live) {
        setIdentity(answer);
      }
    });
    return () => {
      live = false;
    };
  }, []);

  const contributor = identity?.contributor ?? null;
  const member = identity?.member ?? null;

  /*
   * Nothing at all for a reader who is not signed in — and nothing while the
   * answer is in flight, rather than a placeholder. The caller reserves the
   * space, so an empty render here shifts nothing when the chip arrives.
   */
  if (contributor === null && member === null) {
    return null;
  }

  const to = contributor === null ? "/membership" : "/contribute/photos";
  const label =
    contributor === null
      ? "Your membership"
      : `Your photographs — signed in as ${contributor.display_name}`;

  return (
    <Link
      aria-label={label}
      className="glass-hairline inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-white/70 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
      href={to}
      title={label}
    >
      {/*
        An initial rather than a photograph. There is no avatar anywhere in this
        product — a contributor has a name, a slug and an optional website, and
        inventing an image upload for a 28px circle would be a whole feature.
      */}
      <span
        aria-hidden="true"
        className="flex size-6 items-center justify-center rounded-full bg-white/10 font-medium text-[0.6875rem] text-white/90"
      >
        {initial(contributor?.display_name ?? "member")}
      </span>
      <span className={`hidden sm:inline ${META}`}>
        {contributor === null ? "membership" : "your photographs"}
      </span>
    </Link>
  );
}
