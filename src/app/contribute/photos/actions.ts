"use server";

import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { requireContributor } from "@/lib/auth/session";
import {
  deletePhoto,
  publishPhoto,
  setPublished,
} from "@/lib/photos/repository";

export interface PhotoFormState {
  message: string | null;
}

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 300;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Both feeds a photo can appear in. */
function revalidateFeeds(slug: string): void {
  revalidatePath("/");
  revalidatePath(`/by/${slug}`);
}

function text(formData: FormData, key: string, max: number): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function savePhoto(
  _previous: PhotoFormState,
  formData: FormData,
): Promise<PhotoFormState> {
  const actor = await requireContributor();

  const id = formData.get("id");
  if (typeof id !== "string" || id === "") {
    return { message: "Missing photo." };
  }

  const title = text(formData, "title", MAX_TITLE);
  const description = text(formData, "description", MAX_DESCRIPTION);
  if (title === "" || description === "") {
    return { message: "A title and a description are both required." };
  }

  const bgColor = text(formData, "bg_color", 7);
  if (!HEX_COLOR.test(bgColor)) {
    return { message: "The background colour must be a hex value." };
  }

  const location = text(formData, "location", MAX_TITLE);

  // publishPhoto scopes the UPDATE to the actor unless they are the owner,
  // so a forged id changes nothing and returns null.
  const slug = await publishPhoto(
    id,
    {
      title,
      description,
      location: location === "" ? null : location,
      bg_color: bgColor,
    },
    actor,
  );

  if (slug === null) {
    return { message: "That photo could not be found." };
  }

  revalidateFeeds(slug);
  return { message: "Published." };
}

export async function togglePublished(
  id: string,
  published: boolean,
): Promise<void> {
  const actor = await requireContributor();
  const slug = await setPublished(id, published, actor);
  if (slug !== null) {
    revalidateFeeds(slug);
  }
}

export async function removePhoto(id: string): Promise<void> {
  const actor = await requireContributor();
  const pathname = await deletePhoto(id, actor);
  if (pathname === null) {
    return;
  }

  // The row is the source of truth; a blob with no row is unreachable, so it
  // goes too. Failure here is logged rather than surfaced — the photo is
  // already gone from the site, which is what the contributor asked for.
  await del(pathname).catch((error: unknown) => {
    console.error("Could not delete the blob:", error);
  });

  revalidateFeeds(actor.slug);
  revalidatePath("/");
}
