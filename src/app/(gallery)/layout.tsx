import QueryProvider from "@/components/QueryProvider";

/**
 * The two routes that mount the carousel, and the only ones that need a
 * React Query client.
 *
 * The provider used to sit in the root layout, which meant every page on the
 * site shipped `@tanstack/react-query` — about ten kilobytes gzipped — to
 * hold a cache nothing on the page would ever read. `/imprint` and `/terms`
 * are text. `/globe` draws a sphere. `/photographers` is a list of links.
 * None of them has a query in it.
 *
 * Exactly two things use the client: `useViewCount`, through `useRecordView`,
 * and `MemberDetails`. Both render only inside `ImageCarousel`, and the
 * carousel is mounted by `/`, `/photo/[id]` and `/by/[slug]/slideshow` —
 * which is why that third route has a layout of its own carrying the same
 * provider. `/by/[slug]` renders the grid instead and is deliberately left
 * out of both.
 *
 * A layout rather than a wrapper inside each page, and that distinction is
 * load-bearing twice over:
 *
 * - `QueryProvider` holds its client in `useState`, so the cache lives and
 *   dies with whatever owns it. A layout persists across navigation within
 *   its own segment, so walking from the gallery into one photograph keeps
 *   the view counts already fetched; a per-page provider would throw them
 *   away and refetch on every click.
 * - `ImageCarousel` calls `useRecordView` at its own top level, so the
 *   provider has to be strictly above it. Rendering one inside the carousel's
 *   JSX would put it below the hook that needs it, and React Query throws
 *   "No QueryClient set" rather than degrading quietly.
 *
 * A route group changes no URLs: `(gallery)` is a folder name in parentheses,
 * so `page.tsx` here is still `/` and `photo/[id]` is still `/photo/[id]`.
 */
export default function GalleryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <QueryProvider>{children}</QueryProvider>;
}
