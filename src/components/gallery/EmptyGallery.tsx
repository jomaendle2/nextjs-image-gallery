import Link from "next/link";

/**
 * Shown when the feed is empty — a fresh install, or a contributor page whose
 * photos have all been unpublished. It keeps the site's voice rather than
 * reading as an error, because for a visitor it is not one.
 */
export function EmptyGallery({ authorName }: { authorName?: string }) {
  return (
    <main className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#12161a] px-6 text-center">
      <h1 className="font-semibold text-2xl text-white tracking-[-0.045em] sm:text-3xl">
        the beauty of earth.
      </h1>
      <p className="max-w-prose text-balance text-white/60">
        {authorName === undefined
          ? "No photographs here yet."
          : `${authorName} has not published anything yet.`}
      </p>
      {authorName === undefined ? null : (
        <Link
          className="rounded-full px-4 py-2 text-sm text-white/80 underline underline-offset-4 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-white/80 focus-visible:outline-offset-4"
          href="/"
        >
          See the whole gallery
        </Link>
      )}
    </main>
  );
}
