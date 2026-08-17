import { revalidatePath } from "next/cache";

/**
 * Every cached surface a photograph appears on.
 *
 * Shared rather than local, because ad-hoc revalidation lists kept missing
 * one. `/photo/[id]` needs its route pattern and a type rather than a URL —
 * passing one concrete URL clears one concrete URL, and there is one entry
 * per published photograph — so it is the one most easily forgotten, and the
 * one that matters most: it is the URL somebody actually shares.
 *
 * That line was, until recently, clearing nothing at all. None of the three
 * gallery routes had a `generateStaticParams`, so despite each exporting
 * `revalidate = 3600` there was no prerendered entry anywhere for any of
 * them — every visit rendered from scratch and this function swept an empty
 * cache. They now build at deploy and revalidate hourly, which is what makes
 * every path below real; the slideshow was missing outright and is added.
 *
 * The admin actions each hand-rolled a different subset. Revoking a
 * contributor cleared neither their page nor their photographs, so a revoked
 * photographer's work went on being served for up to an hour after the owner
 * had removed them, which is the whole point of the button.
 */
export function revalidateFeeds(slug: string): void {
  revalidatePath("/");
  revalidatePath(`/by/${slug}`);
  /*
   * The grid and the slideshow are separate cache entries, and only the grid
   * was ever cleared. A photographer who published, looked at their own
   * slideshow and saw yesterday's set would have no way to tell that from
   * the upload having failed.
   */
  revalidatePath(`/by/${slug}/slideshow`);
  revalidatePath("/photo/[id]", "page");
  revalidatePath("/photographers");
  /*
   * The globe is fed by `coarse_lat`/`coarse_lng`, which `publishPhoto`
   * writes on the same save as the title — so a photographer marking a spot
   * and finding the map unchanged for an hour would read as the feature not
   * working. It belongs on this list for the same reason everything else
   * here does: ad-hoc revalidation kept missing one.
   */
  revalidatePath("/globe");
}
