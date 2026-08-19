import { MAX_NAME, MAX_URL } from "@/lib/applications/validate";
import { formText } from "@/lib/form-state";
import { looksLikeEmail, normaliseEmail, normaliseSiteUrl } from "./slug";

export type InviteInput =
  | { email: string; displayName: string; siteUrl: string | null }
  | { error: string };

/**
 * The three fields that bring a photographer in, checked.
 *
 * Both doors post the same `InviteForm`, so both read it the same way. They
 * did not: the owner's action trimmed the address and the contributor's
 * normalised it, so the same person typed two different ways was two
 * different strings depending on which form they arrived through. The insert
 * normalises either way, so no duplicate row was possible — but two
 * validators behind one component is the shape that becomes a bug on the
 * next change to either.
 *
 * `actorEmail` is the sender's own address, so inviting yourself is answered
 * plainly. The claim would refuse it anyway — an inviter is a contributor,
 * so their address fails its "already a photographer" guard and costs no
 * quota — but being told that about your own address is confusing, and this
 * check is race-free by construction because the address comes from the
 * session rather than a read.
 */
export function readInviteForm(
  formData: FormData,
  actorEmail: string,
): InviteInput {
  const email = normaliseEmail(formText(formData, "email", MAX_URL));
  const displayName = formText(formData, "display_name", MAX_NAME);
  const siteUrlRaw = formText(formData, "site_url", MAX_URL);

  if (!looksLikeEmail(email) || displayName === "") {
    return { error: "An email address and a name are required." };
  }

  if (email === normaliseEmail(actorEmail)) {
    return { error: "That is your own address." };
  }

  if (siteUrlRaw === "") {
    return { email, displayName, siteUrl: null };
  }

  const siteUrl = normaliseSiteUrl(siteUrlRaw);
  if (siteUrl === null) {
    return { error: "That website address does not look like a URL." };
  }
  return { email, displayName, siteUrl };
}
