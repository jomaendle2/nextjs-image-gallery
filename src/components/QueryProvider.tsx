"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { prefetchAllViewCounts } from "@/hooks/useViewCount";

const STALE_TIME_MS = 5 * 60 * 1000;

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

  // Warm the view-count cache without blocking the first paint. The effect
  // already runs after paint, so the extra setTimeout hop it used to make
  // only delayed the request by a further macrotask.
  useEffect(() => {
    prefetchAllViewCounts(queryClient).catch((error: unknown) => {
      console.error("Failed to prefetch view counts:", error);
    });
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
