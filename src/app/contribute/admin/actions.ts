"use server";

import { revalidatePath } from "next/cache";
import { buildAnnouncement } from "@/lib/announcement";
import { reviewApplication } from "@/lib/applications/repository";
import {
  inviteContributor,
  isOwnerContributor,
  setContributorRevoked,
} from "@/lib/auth/contributors";
import {
  sendApplicationApproved,
  sendApplicationDeclined,
  sendInvitation,
  sendNewWorkAnnouncement,
} from "@/lib/auth/email";
import { requireContributor } from "@/lib/auth/session";
import { looksLikeEmail, normaliseSiteUrl } from "@/lib/auth/slug";
import { isOwner } from "@/lib/auth/types";
import { toGalleryImage } from "@/lib/photos/map";
import {
  listUnannouncedPhotos,
  markAnnounced,
  setOpener,
  setPublished,
} from "@/lib/photos/repository";
import { siteOrigin } from "@/lib/site-url";
import { listConfirmedSubscribers } from "@/lib/subscribers/repository";
import type { InviteState } from "../invite-state";

/** What a send did, for the button to report. */
export interface AnnounceResult {
  sent: number;
  failed: number;
  photographs: number;
}

/**
 * Kept as a name rather than a shape: the form is now shared with the
 * contributor invite, so the shape lives in `../invite-state` and this is an
 * alias. A type alias is erased, so it is legal to export from a
 * `"use server"` module where a value would not be.
 */
export type AdminFormState = InviteState;

const MAX_NAME = 80;

/**
 * Every action here re-checks the role on the server.
 *
 * Hiding a button is a UI convenience, not a permission — a contributor who
 * knows the action exists can invoke it directly, so the check has to live
 * where the work happens.
 */
async function requireOwner() {
  const actor = await requireContributor();
  if (!isOwner(actor)) {
    throw new Error("Not allowed.");
  }
  return actor;
}

export async function invite(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireOwner();

  const email = String(formData.get("email") ?? "").trim();
  const displayName = String(formData.get("display_name") ?? "")
    .trim()
    .slice(0, MAX_NAME);
  const siteUrlRaw = String(formData.get("site_url") ?? "").trim();

  if (!looksLikeEmail(email) || displayName === "") {
    return {
      message: "An email address and a display name are required.",
      tone: "error" as const,
    };
  }

  let siteUrl: string | null = null;
  if (siteUrlRaw !== "") {
    siteUrl = normaliseSiteUrl(siteUrlRaw);
    if (siteUrl === null) {
      return {
        message: "That website address does not look like a URL.",
        tone: "error" as const,
      };
    }
  }

  const created = await inviteContributor({
    email,
    display_name: displayName,
    site_url: siteUrl,
  });

  if (created === null) {
    return {
      message: "That address is already invited.",
      tone: "error" as const,
    };
  }

  /*
   * The invitation is the email, not the database row.
   *
   * This used to create the row and stop, leaving the owner to tell each
   * person separately — while the application path, three functions down,
   * has always sent mail. The same act had two behaviours depending on
   * which door somebody came through.
   *
   * A failed send is reported rather than thrown: the invitation exists
   * either way, and the owner needs to know to follow up by hand rather
   * than believe it went out.
   */
  let mailed = true;
  try {
    await sendInvitation(created.email, created.display_name);
  } catch (error) {
    mailed = false;
    console.error("Could not send the invitation:", error);
  }

  revalidatePath("/contribute/admin");
  return {
    message: mailed
      ? `Invited ${created.display_name} — an invitation is on its way to ${created.email}.`
      : `Invited ${created.display_name}, but the email could not be sent. Tell them to sign in at /contribute with ${created.email}.`,
    tone: mailed ? ("success" as const) : ("error" as const),
  };
}

/**
 * Approving reuses `inviteContributor`, so there stays exactly one code path
 * that brings a contributor into existence.
 *
 * The welcome email points at /contribute rather than carrying a sign-in
 * token: a token mailed today would sit in an inbox for days, and the
 * applicant can mint a fresh one the moment they are ready.
 */
export async function decideApplication(
  id: string,
  decision: "approved" | "declined",
): Promise<void> {
  await requireOwner();

  const application = await reviewApplication(id, decision);
  if (!application) {
    return;
  }

  if (decision === "approved") {
    const invited = await inviteContributor({
      email: application.email,
      display_name: application.display_name,
      site_url: application.site_url,
    });

    /*
     * `inviteContributor` is `ON CONFLICT (email) DO NOTHING`, so it returns
     * null when a row already exists — most importantly a revoked one.
     * Discarding that meant the application flipped to approved and the
     * "you're in" email went out while nothing was created or un-revoked:
     * the person could never sign in, and the owner had no way to notice,
     * because the application had left the pending list. The `invite` action
     * has always handled this null; this path did not.
     */
    if (invited === null) {
      throw new Error(
        `${application.email} already has a contributor record. It may be ` +
          "revoked — restore it from the contributors list instead.",
      );
    }

    try {
      await sendApplicationApproved(
        application.email,
        application.display_name,
      );
    } catch (error) {
      // The invitation exists either way; a failed email is recoverable.
      console.error("Could not send the welcome email:", error);
    }
  }

  /*
   * Declining used to send nothing, while the apply form promised a reply
   * "in a few days" — so a no was indistinguishable from being ignored, for
   * as long as the applicant cared to wait. Same failure handling as the
   * approval: the decision is already recorded, so a bounced message is
   * logged rather than raised.
   */
  if (decision === "declined") {
    try {
      await sendApplicationDeclined(
        application.email,
        application.display_name,
      );
    } catch (error) {
      console.error("Could not send the decline email:", error);
    }
  }

  revalidatePath("/contribute/admin");
  revalidatePath("/photographers");
}

export async function setRevoked(id: string, revoked: boolean): Promise<void> {
  await requireOwner();

  /*
   * An owner cannot be revoked, checked here rather than only in the button.
   *
   * `ContributorRowActions` hides the control for owners, and that was the
   * whole enforcement — a client-side rule protecting the one action that
   * cannot be undone through the interface. Revoking an owner deletes their
   * sessions and makes `/contribute/admin` return 404 for everybody, so
   * recovery means going to the database. A server action is a public
   * endpoint; anything the interface merely declines to offer has to be
   * refused here too.
   */
  if (revoked && (await isOwnerContributor(id))) {
    throw new Error("An owner cannot be revoked.");
  }

  await setContributorRevoked(id, revoked);
  revalidatePath("/contribute/admin");
  revalidatePath("/photographers");
  // A revoked contributor's photos drop out of the feed, which joins on
  // `revoked_at IS NULL`, so the public pages have to be rebuilt too.
  revalidatePath("/");
}

export async function pinOpener(id: string): Promise<void> {
  await requireOwner();
  await setOpener(id);
  revalidatePath("/contribute/admin");
  revalidatePath("/");
}

export async function ownerSetPublished(
  id: string,
  published: boolean,
): Promise<void> {
  const actor = await requireOwner();
  const slug = await setPublished(id, published, actor);
  revalidatePath("/contribute/admin");
  revalidatePath("/");
  if (slug !== null) {
    revalidatePath(`/by/${slug}`);
  }
}

/**
 * Sends the announcement to every confirmed subscriber.
 *
 * Owner-only, and the only path by which anything reaches the list. The
 * weekly cron does not send — it emails the owner that there is something
 * to send, and this is what they press.
 */
export async function announceNewWork(): Promise<AnnounceResult> {
  await requireOwner();

  const rows = await listUnannouncedPhotos();
  if (rows.length === 0) {
    return { sent: 0, failed: 0, photographs: 0 };
  }

  const subscribers = await listConfirmedSubscribers();
  const images = rows.map(toGalleryImage);
  const origin = siteOrigin();

  /*
   * Marked before a single message goes out, not after.
   *
   * If this dies halfway through the list, the choice is between some
   * subscribers getting a second copy next week and these photographs never
   * being announced. The duplicate is the worse one: an unannounced
   * photograph is still on the site, in both feeds and in the sitemap, while
   * a list that mails people twice is harder to win back.
   */
  await markAnnounced(rows.map((row) => row.id));

  let sent = 0;
  let failed = 0;

  for (const subscriber of subscribers) {
    const message = buildAnnouncement(
      images,
      origin,
      `${origin}/subscribe/unsubscribe?token=${encodeURIComponent(subscriber.unsubscribe_token)}`,
    );
    try {
      // biome-ignore lint/performance/noAwaitInLoops: one message per recipient, and a provider is happier with a queue than a burst
      await sendNewWorkAnnouncement(subscriber.email, message);
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error(`Announcement to ${subscriber.email} failed:`, error);
    }
  }

  revalidatePath("/contribute/admin");
  return { sent, failed, photographs: images.length };
}
