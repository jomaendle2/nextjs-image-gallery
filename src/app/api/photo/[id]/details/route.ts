import { after, NextResponse } from "next/server";
import { getCurrentContributor, getCurrentMember } from "@/lib/auth/session";
import { isOwner } from "@/lib/auth/types";
import { recordMemberView } from "@/lib/members/repository";
import { getMemberDetails } from "@/lib/photos/repository";
import { memberDetailsLimiter, memberViewLimiter } from "@/lib/rate-limit";

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
  /*
   * Member first, author only if that fails, and the order is a cost
   * decision rather than a preference.
   *
   * The member branch returns before `getCurrentContributor` is reached, so
   * a member never pays for a second session lookup — and an anonymous
   * reader pays nothing for it either, because that function early-returns
   * on the absent cookie. Only a signed-in non-member, the photographer this
   * branch exists for, pays the extra round trip. Written as early returns
   * rather than as a comment claiming the same thing: the shape is the
   * guarantee.
   *
   * A combined `sessionPrincipal()` — one `sessions LEFT JOIN members LEFT
   * JOIN contributors` — was considered and not done. The reason recorded
   * here at first was that it "would make every anonymous 403 pay for two
   * joins", and that was simply false: `getCurrentMember` early-returns on
   * the absent cookie exactly as `getCurrentContributor` does, so a combined
   * function would too, and an anonymous reader pays nothing either way. The
   * honest ledger is that a member would pay one extra LEFT JOIN on a row
   * already being joined, and a contributor would *save* a round trip.
   *
   * What is left is the reason that actually holds: it would be a third way
   * to resolve a session in a codebase that already has two, and this route
   * is the first caller that needs both. Worth doing when a second one
   * appears; not worth doing for one caller.
   */
  const member = await getCurrentMember();
  const { id } = await params;

  /*
   * The member branch, unchanged in everything that matters.
   *
   * `memberDetailsLimiter.check(member.email)` is written out literally
   * because `security.test.ts` pins that exact call. The author branch below
   * shares the same limiter instance rather than getting one of its own: a
   * photographer who is also a member would otherwise hold two independent
   * budgets, which is one more than anybody should have.
   */
  if (member !== null) {
    /*
     * Limited, now that this returns a coordinate as well as prose.
     *
     * The gap was defensible while the payload was two sentences: awkward to
     * scrape, near worthless in aggregate. An exact point is the opposite —
     * machine-actionable and worth exactly as much as the number of them you
     * can collect — so one member with a loop is the threat this feature
     * introduced, and the limit is what answers it.
     *
     * Keyed by the member, not the address: an anonymous caller was already
     * refused above, and a member on a shared connection should not be
     * limited by their neighbours.
     */
    if (!memberDetailsLimiter.check(member.email)) {
      return NextResponse.json(
        { error: "Too many requests. Try again shortly." },
        { status: 429 },
      );
    }

    const details = await getMemberDetails(id);
    if (details === null) {
      return NextResponse.json(
        { error: "No such photograph." },
        { status: 404 },
      );
    }

    /*
     * Counted here because this is the moment a member actually receives the
     * thing they pay for. Aggregate per photograph per day — see the note on
     * the table — so it can divide a revenue pool later without becoming a
     * record of what any one person looked at.
     *
     * `after` rather than a bare floating promise. Detached work started
     * without it races the response: the function can be frozen or reclaimed
     * the moment the body is sent, so the Neon round trip may simply never
     * land. That was silently losing views, and these numbers are the input
     * to dividing money between photographers — an undercount nobody can
     * detect is worse than a slow response.
     */
    /*
     * Once per member per photograph per day, and the dedup is in memory
     * rather than in a table — see `memberViewLimiter`. Without it the
     * number measured *fetches*: a member on their own photograph with a
     * finger on the refresh key added a view per press, and these counts
     * divide a revenue pool between photographers.
     */
    if (memberViewLimiter.check(`${member.email}:${id}`)) {
      after(async () => {
        try {
          await recordMemberView(id);
        } catch (error) {
          console.error("Could not record a member view:", error);
        }
      });
    }

    /*
     * Never stored by anything between here and the member who asked.
     * The response varies by session cookie, and the one thing that must not
     * happen is a shared cache holding a member's copy and handing it to the
     * next anonymous reader. Vercel does not cache route handlers by
     * default, so this changes nothing today — it is here so that a future
     * edge cache, a proxy, or a browser back-button does not turn a correct
     * gate into a leak without anybody editing this file.
     */
    return NextResponse.json(
      { access: "member", ...details },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  /*
   * ─── The author branch. Everything below here is a photographer reading
   * their own writing, and it must never touch the view counter. ───
   *
   * **`recordMemberView` is deliberately absent, and this is the loudest
   * comment in the file for a reason.** Those counts divide a revenue pool
   * between photographers. An author who could increment their own row by
   * holding down a refresh key would be able to inflate their own payout,
   * turning a measure of what members read into a measure of who is most
   * willing to press a button. The member branch above returns before
   * reaching here, so the counter is reachable only from the branch where
   * somebody actually paid.
   *
   * The guarantee is exactly that and no more. A contributor who *also* holds
   * a membership takes the member branch on their own photographs and does
   * record a view — correctly, because they paid for one. What bounds it
   * there is `memberViewLimiter`: one per member per photograph per day, in
   * memory, so a cold start under Fluid Compute forgets. Somebody determined
   * could add a handful a day to their own row. That is a rounding error
   * against a pool; a refresh key was not.
   *
   * Nobody signed in at all gets the same refusal an anonymous reader has
   * always had. 403 rather than 404: the photograph exists and the reader
   * can see it; what is missing is a membership, and saying so is the point,
   * because that is the response the interface turns into an invitation.
   *
   * `signedIn: false` is what stops the client's "one refusal ends the
   * asking" optimisation from resurrecting the bug this route fixes. See
   * `nextSessionAccess` in `lib/members/access.ts` — membership is a fact
   * about the session, authorship is a fact about the photograph, and only
   * the first may be settled by a single no.
   */
  const contributor = await getCurrentContributor();
  if (contributor === null) {
    return NextResponse.json(
      { access: "none", signedIn: false },
      { status: 403 },
    );
  }

  // Same limiter instance, keyed by contributor id — matching
  // `suggestLimiter.check(contributor.id)`, the other per-photographer gate.
  if (!memberDetailsLimiter.check(contributor.id)) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429 },
    );
  }

  const own = await getMemberDetails(id, {
    contributorId: contributor.id,
    isOwner: isOwner(contributor),
  });

  /*
   * Somebody else's photograph, or none. A refusal rather than a 404,
   * because from here the two are the same fact and the interface treats
   * them the same way.
   *
   * `signedIn: true` is the load-bearing half: it tells the panel that this
   * no is about *this photograph*, not about the session, so the next
   * photograph is still worth asking about. Without it, a photographer who
   * opened a colleague's work first would never see their own notes again
   * for the life of the tab.
   */
  if (own === null) {
    return NextResponse.json(
      { access: "none", signedIn: true },
      { status: 403 },
    );
  }

  return NextResponse.json(
    { access: "author", ...own },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
