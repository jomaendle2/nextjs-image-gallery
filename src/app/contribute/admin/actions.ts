"use server";

import { revalidatePath } from "next/cache";
import { reviewApplication } from "@/lib/applications/repository";
import {
  inviteContributor,
  setContributorRevoked,
} from "@/lib/auth/contributors";
import { sendApplicationApproved } from "@/lib/auth/email";
import { requireContributor } from "@/lib/auth/session";
import { isOwner } from "@/lib/auth/types";
import { setOpener, setPublished } from "@/lib/photos/repository";

export interface AdminFormState {
  message: string | null;
}

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

  if (!email.includes("@") || displayName === "") {
    return { message: "An email address and a display name are required." };
  }

  let siteUrl: string | null = null;
  if (siteUrlRaw !== "") {
    try {
      const parsed = new URL(siteUrlRaw);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        throw new Error("bad protocol");
      }
      siteUrl = parsed.toString();
    } catch {
      return { message: "That website address does not look like a URL." };
    }
  }

  const created = await inviteContributor({
    email,
    display_name: displayName,
    site_url: siteUrl,
  });

  if (created === null) {
    return { message: "That address is already invited." };
  }

  revalidatePath("/contribute/admin");
  return {
    message: `Invited ${created.display_name}. They can sign in at /contribute with ${created.email}.`,
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
    await inviteContributor({
      email: application.email,
      display_name: application.display_name,
      site_url: application.site_url,
    });

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

  revalidatePath("/contribute/admin");
  revalidatePath("/photographers");
}

export async function setRevoked(id: string, revoked: boolean): Promise<void> {
  await requireOwner();
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
