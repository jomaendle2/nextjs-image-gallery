import QueryProvider from "@/components/QueryProvider";

/**
 * The third carousel route, and the reason it has a layout of its own rather
 * than joining the `(gallery)` group.
 *
 * The slideshow is nested inside `by/[slug]/`, whose own page — the grid —
 * must stay outside the group: `PhotoGrid` imports neither `useViewCount`
 * nor `MemberDetails`, so a photographer's gallery page has no use for a
 * query client. Moving this folder up into `(gallery)` would change its URL,
 * and the URL is the thing a photographer shares.
 *
 * So the provider comes to it. A layout file inside `slideshow/` already
 * applies to exactly one route without any grouping being needed, and being
 * a layout is what matters — it persists across navigation within the
 * slideshow, which a wrapper rendered by the page would not. See the note in
 * `src/app/(gallery)/layout.tsx` for why that and the ordering against
 * `useRecordView` are the two rules here.
 *
 * The cost of the split is one extra `QueryClient`: walking from `/` to a
 * photographer's slideshow crosses from one provider to another and starts
 * with a cold view-count cache. That is one request for the whole table, on
 * a navigation that is already fetching a page.
 */
export default function SlideshowLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <QueryProvider>{children}</QueryProvider>;
}
