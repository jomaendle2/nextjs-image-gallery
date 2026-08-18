import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { allSourceFiles, code, read, SRC } from "./source-text";

/**
 * The invariants around the member-only half of a photograph.
 *
 * A fourth security file rather than a longer third one, on the seam this
 * codebase has already split along twice. What these hold is narrower than
 * "paid columns are not in a public payload" — `security.test.ts` already
 * pins that — and is about the two bugs that shipped anyway: a teaser
 * advertising a tier nobody could buy, and a photographer getting a 403 on
 * their own writing.
 *
 * The first check below is the one that matters most. It is the check that
 * would have caught the slideshow page, which rendered the carousel without
 * the flag and was found by reading, not by testing.
 */

describe("a carousel cannot render without being told what is on sale", () => {
  /*
   * `membershipOffered` defaults to `false` in `ImageCarousel`, which is the
   * right default — a subtree that was not told hides the offer rather than
   * inventing one. But a default that is silently correct is also silently
   * *wrong* on a page that simply forgot, and that is exactly what happened:
   * two of the three pages passed it and the third did not, so a photograph
   * opened from a photographer's slideshow advertised a membership while the
   * same photograph opened from the gallery did not.
   */
  it("every page rendering ImageCarousel passes membershipOffered", () => {
    const pages = allSourceFiles()
      .map((file) => ({ file, source: readFileSync(file, "utf8") }))
      .filter(({ source }) => source.includes("<ImageCarousel"));

    // If this finds nothing, the detection has broken, not the code.
    expect(pages.length).toBeGreaterThan(0);

    const silent = pages
      .filter(({ source }) => !source.includes("membershipOffered="))
      .map(({ file }) => file.replace(SRC, ""));
    expect(silent).toEqual([]);
  });

  it("no client file reads the Stripe configuration itself", () => {
    /*
     * `membershipConfigured()` is server-only, and the reason is in
     * `GalleryTopBar`'s own docblock: a key read from a module that ships to
     * the browser is a key in the browser bundle. The flag reaches the
     * client as a prop and then as a context, never as a call.
     */
    const leaking = allSourceFiles()
      .map((file) => ({ file, source: readFileSync(file, "utf8") }))
      .filter(({ source }) => source.startsWith('"use client"'))
      /*
       * `code()` rather than the raw text: `GalleryTopBar` explains at its
       * own top *why* it takes a prop instead of calling this, and a check
       * that punishes a file for documenting the rule is a check that gets
       * the documentation deleted.
       */
      .filter(({ source }) => code(source).includes("membershipConfigured"))
      .map(({ file }) => file.replace(SRC, ""));

    expect(leaking).toEqual([]);
  });
});

describe("the details route", () => {
  const route = read("app", "api", "photo", "[id]", "details", "route.ts");

  it("asks about a membership before it asks about authorship", () => {
    /*
     * The order is a cost decision, and it is load-bearing. Anonymous
     * readers never reach the contributor lookup at all — `getCurrentMember`
     * fails first and `getCurrentContributor` early-returns on the absent
     * cookie — and a member never pays for a second query. Only the
     * signed-in non-member, the person this branch exists for, pays for two.
     */
    const memberAt = route.indexOf("getCurrentMember(");
    const contributorAt = route.indexOf("getCurrentContributor(");
    expect(memberAt).toBeGreaterThan(-1);
    expect(contributorAt).toBeGreaterThan(-1);
    expect(memberAt).toBeLessThan(contributorAt);
  });

  it("never counts a view on the author branch", () => {
    /*
     * **The revenue-integrity invariant.** `photo_member_views` divides a
     * pool between photographers. An author who could increment their own
     * row by holding down a refresh key could inflate their own payout, and
     * the counter would stop measuring what members read.
     *
     * The author branch is everything after the marker comment, which is
     * placed where the member branch has already returned.
     */
    const body = code(route);
    const authorBranch = body.slice(
      body.indexOf("memberDetailsLimiter.check(contributor.id)"),
    );
    // Comments stripped, and anchored on code: the marker comment above the
    // branch names `recordMemberView` in order to say it must not be there.
    expect(authorBranch).toContain("getMemberDetails(id, {");
    expect(authorBranch).not.toContain("recordMemberView");
  });

  it("tells a refused reader whether they are signed in", () => {
    /*
     * Without this the client's "one refusal ends the asking" optimisation
     * resurrects the bug: a photographer who opens somebody else's work
     * first would have the query disabled for the whole tab.
     */
    expect(route).toContain("signedIn");
  });

  it("answers with a reason, not a boolean", () => {
    // `member: true` to an author is a lie, and the client caches it as a
    // fact about the session rather than about the photograph.
    expect(route).not.toMatch(/\bmember:\s*(?:true|false)\b/);
    expect(route).toContain('access: "author"');
    expect(route).toContain('access: "member"');
  });
});

describe("the author branch is disjoint, not a disjunct", () => {
  const repository = read("lib", "photos", "repository.ts");
  /*
   * Comments stripped first. The docblock on the author branch says
   * "`published_at IS NOT NULL` is deliberately absent from it", which reads
   * to a substring count exactly like a second occurrence of the condition.
   */
  const slice = code(repository).slice(
    code(repository).indexOf("export async function getMemberDetails"),
    code(repository).indexOf("export async function listGlobePoints"),
  );

  it("the public conditions appear exactly once", () => {
    /*
     * The trap this exists to catch. Adding ownership as a disjunct to the
     * existing WHERE — `(published AND not revoked) OR author` — would let
     * *any* signed-in contributor read the paid columns of *every* published
     * photograph, because the first half is true for all of them no matter
     * who is asking. That is a silent widening from "members" to "anybody
     * holding a contributor session": the opposite of this change, wearing
     * its clothes.
     *
     * Counting the public condition proves the two queries are separate. If
     * it ever appears twice, or zero times, somebody has merged them.
     */
    const occurrences = slice.split("published_at IS NOT NULL").length - 1;
    expect(occurrences).toBe(1);
  });

  it("the author query asks about ownership and nothing else", () => {
    // Regexes rather than literals: a string holding a template placeholder
    // is exactly what `noTemplateCurlyInString` is looking for, and it cannot
    // tell an assertion about one from an accident.
    expect(slice).toMatch(/p\.author_id = \$\{asAuthor\.contributorId\}/);
    // Postgres will not infer a boolean parameter's type inside an OR.
    expect(slice).toMatch(/\$\{asAuthor\.isOwner\}::boolean/);
  });

  it("keeps one exported name, so the caller census still works", () => {
    /*
     * `security.test.ts` enumerates every reader of the paid columns by
     * matching the substring `getMemberDetails(`. A second function named
     * `getOwnMemberDetails` would not contain it and would slip straight
     * past the test that exists to notice exactly this.
     */
    expect(slice).not.toMatch(/export async function getOwn/);
  });
});
