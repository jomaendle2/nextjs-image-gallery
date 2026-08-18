/**
 * What a session may see of a photograph's member-only half.
 *
 * Pure, and deliberately so: no JSX, no environment, no imports. The route
 * decides access against a database and the panel decides display against a
 * cache, and the two used to agree only by both being written carefully. The
 * decisions themselves are three small functions, so they can be tested under
 * the `node` environment rather than only by clicking.
 */

/**
 * Why a reader is being shown the paid columns — or why they are not.
 *
 * This replaced a bare `member: boolean` on the wire. Two reasons:
 *
 * Returning `member: true` to a photographer reading their own notes is a
 * lie, and the client caches it as a *session* fact — so one look at their
 * own photograph would have convinced the tab that the whole session held a
 * membership, and every other photograph would then hold its blank line
 * waiting for content that is never coming.
 *
 * And "none" needs to be distinguishable from "not asked": the panel treats
 * a refusal as final for the session, which is right for membership and
 * wrong for authorship.
 */
export type PhotoAccess = "member" | "author" | "none";

/**
 * What the session flag becomes after one answer.
 *
 * The asymmetry here is the whole model. **Membership is a property of the
 * session**, so one refusal settles it and the panel can stop asking — that
 * optimisation is why a non-member does not fire a request per swipe.
 * **Authorship is a property of the photograph**, so a refusal settles
 * nothing: the next photograph may well be theirs.
 *
 * Without that distinction the fix reintroduces the bug in a subtler form. A
 * photographer who opens somebody else's photograph first gets a 403; the
 * flag goes false; the query is disabled for the rest of the tab; and their
 * own photograph shows the teaser again — with no request made and nothing in
 * the console to suggest why.
 *
 * So a 403 only settles the session when the reader is not signed in at all.
 * `null` means "still unknown", which leaves the panel asking.
 */
export function nextSessionAccess(
  answer: PhotoAccess,
  signedIn: boolean,
): boolean | null {
  if (answer === "member") {
    return true;
  }
  if (answer === "author") {
    // Says nothing either way about a membership. Keep asking.
    return null;
  }
  return signedIn ? null : false;
}

/** Whether this answer should be replaced by an offer to subscribe. */
export function showsTeaser(answer: PhotoAccess, offered: boolean): boolean {
  return answer === "none" && offered;
}

/**
 * Whether an answer that may belong to the *previous* photograph is safe to
 * keep on screen while the next one loads.
 *
 * Only a refusal is. An offer to subscribe is a statement about the session
 * and reads identically under any photograph; a location belongs to one
 * photograph, and showing the previous one's for even a tenth of a second
 * would be quietly wrong in the one place this site promises precision. The
 * author case is a location too, so it is held back exactly like a member's.
 */
export function mayDisplayStale(answer: PhotoAccess): boolean {
  return answer === "none";
}
