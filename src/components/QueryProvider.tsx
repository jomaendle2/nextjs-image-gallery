"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

const STALE_TIME_MS = 5 * 60 * 1000;

/**
 * The React Query client, mounted by the two layouts that carry the
 * carousel — `src/app/(gallery)/layout.tsx` and the slideshow's — and by
 * nothing else. It is not in the root layout, and the note in the first of
 * those explains at length why not.
 *
 * There was an effect here that prefetched the whole view-count table on
 * mount, described as warming the cache without blocking first paint. It was
 * not a warm-up, it was a duplicate: `ViewCount` renders on first paint and
 * its `useQuery` declares the same `queryKey`, the same `queryFn` and the
 * same `staleTime`, so React Query deduped the two and discarded one of
 * them. Removing it removes a request that was never sent.
 */
export default function QueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: STALE_TIME_MS,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
