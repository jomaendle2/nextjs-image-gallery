"use server";

import { revalidatePath } from "next/cache";
import {
  inviteContributor,
  setContributorRevoked,
} from "@/lib/auth/contributors";
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

export async function setRevoked(id: string, revoked: boolean): Promise<void> {
  await requireOwner();
  await setContributorRevoked(id, revoked);
  revalidatePath("/contribute/admin");
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
