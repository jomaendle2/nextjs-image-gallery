import { SiteFooter } from "@/components/SiteFooter";
import { TextLink } from "@/components/ui/TextLink";

/**
 * Shown when the feed is empty — a fresh install, or a contributor page whose
 * photographs have all been unpublished. It keeps the site's voice rather
 * than reading as an error, because for a visitor it is not one.
 *
 * Always carries a way onward. The version before this rendered the "see the
 * whole gallery" link only for a contributor page, so an empty main gallery
 * was a full-screen panel with a heading, one sentence and no link of any
 * kind — no photographers, no legal notice, nothing. An empty state is still
 * a page somebody has to leave.
 */
export function EmptyGallery({ authorName }: { authorName?: string }) {
  return (
    <main className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
      <h1 className="font-semibold text-2xl text-white tracking-[-0.045em] sm:text-3xl">
        the beauty of earth.
      </h1>
      <p className="max-w-prose text-balance text-white/60">
        {authorName === undefined
          ? "No photographs here yet."
          : `${authorName} has not published anything yet.`}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
        {authorName === undefined ? null : (
          <TextLink href="/" standalone={true}>
            See the whole gallery
          </TextLink>
        )}
        <TextLink href="/photographers" standalone={true}>
          Photographers
        </TextLink>
      </div>

      <SiteFooter className="mt-4 justify-center" />
    </main>
  );
}
