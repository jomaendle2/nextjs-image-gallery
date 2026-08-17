import { NextResponse } from "next/server";
import { getCurrentContributor, memberForSession } from "@/lib/auth/session";
import { isActive } from "@/lib/members/status";

/**
 * Who the caller is, for the one chip that has to say so.
 *
 * **Why a request and not a prop.** The gallery is statically rendered and one
 * cached HTML document is served to everybody, so nothing on it can be
 * rendered from a session without making every anonymous visitor pay for a
 * dynamic render — the same reasoning that keeps authentication out of
 * middleware here, and the same reasoning `/api/photo/[id]/details` records at
 * length. A signed-in reader had no route back to their own photographs from
 * anywhere on the public site; this is the cheapest way to give them one
 * without turning the front page dynamic.
 *
 * **It answers only about the caller.** Everything here comes from the
 * caller's own cookie and is already theirs: their display name, their public
 * slug, and whether their own membership is active. There is no parameter, so
 * there is nothing to steer — this route cannot be asked about anybody else.
 *
 * **`no-store`, and that is not optional.** A response that varies per cookie
 * must never be held by a shared cache; one CDN hit would hand one reader's
 * name to the next. The route is dynamic for the same reason.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  /*
   * Both capabilities, because a person can hold either, both or neither, and
   * the chip needs to know which — a contributor's things are their
   * photographs, a member's are their membership.
   *
   * `memberForSession` rather than `getCurrentMember`, then `isActive` here:
   * a lapsed member has the most urgent reason of anyone to reach the portal,
   * so the chip should still offer it. What it must not do is claim the
   * membership is live.
   */
  const [contributor, member] = await Promise.all([
    getCurrentContributor(),
    memberForSession(),
  ]);

  return NextResponse.json(
    {
      contributor:
        contributor === null
          ? null
          : {
              slug: contributor.slug,
              display_name: contributor.display_name,
            },
      member: member === null ? null : { active: isActive(member) },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
