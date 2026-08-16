import { revalidatePath } from "next/cache";

/**
 * Every cached surface a photograph appears on.
 *
 * Shared rather than local, because ad-hoc revalidation lists kept missing
 * one. `/photo/[id]` is its own ISR entry with `revalidate = 3600` and needs
 * its route pattern and a type — passing one concrete URL clears one concrete
 * URL — so it is the one most easily forgotten, and the one that matters
 * most: it is the URL somebody actually shares.
 *
 * The admin actions each hand-rolled a different subset. Revoking a
 * contributor cleared neither their page nor their photographs, so a revoked
 * photographer's work went on being served for up to an hour after the owner
 * had removed them, which is the whole point of the button.
 */
export function revalidateFeeds(slug: string): void {
  revalidatePath("/");
  revalidatePath(`/by/${slug}`);
  revalidatePath("/photo/[id]", "page");
  revalidatePath("/photographers");
}
