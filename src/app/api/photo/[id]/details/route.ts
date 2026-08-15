import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/auth/session";
import { recordMemberView } from "@/lib/members/repository";
import { getMemberDetails } from "@/lib/photos/repository";

/**
 * The member-only half of a photograph.
 *
 * A separate request rather than fields on the page, and that is the whole
 * security design. Gating in a component only hides what was already sent:
 * `precise_location` in the page payload is readable by anyone who opens
 * the view-source, subscription or not. These columns are therefore never
 * selected by `listPublishedPhotos`, and this is the only route that reads
 * them.
 *
 * Keeping it out of the page has a second benefit. The gallery is
 * statically rendered and cached; a server component reading the session to
 * decide what to render would make every anonymous visitor pay for a
 * feature that serves subscribers — the same reasoning that keeps
 * authentication out of middleware in this codebase.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const member = await getCurrentMember();
  if (member === null) {
    /*
     * 403 rather than 404: the photograph exists and the reader can see it.
     * What is missing is a membership, and saying so is the point — this is
     * the response the interface turns into an invitation.
     */
    return NextResponse.json({ member: false }, { status: 403 });
  }

  const { id } = await params;
  const details = await getMemberDetails(id);
  if (details === null) {
    return NextResponse.json({ error: "No such photograph." }, { status: 404 });
  }

  /*
   * Counted here because this is the moment a member actually receives the
   * thing they pay for. Aggregate per photograph per day — see the note on
   * the table — so it can divide a revenue pool later without becoming a
   * record of what any one person looked at.
   */
  recordMemberView(id).catch((error: unknown) => {
    console.error("Could not record a member view:", error);
  });

  /*
   * Never stored by anything between here and the member who asked.
   * The response varies by session cookie, and the one thing that must not
   * happen is a shared cache holding a member's copy and handing it to the
   * next anonymous reader. Vercel does not cache route handlers by default,
   * so this changes nothing today — it is here so that a future edge cache,
   * a proxy, or a browser back-button does not turn a correct gate into a
   * leak without anybody editing this file.
   */
  return NextResponse.json(
    { member: true, ...details },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
