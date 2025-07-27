"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { prefetchAllViewCounts } from "@/hooks/useViewCount";

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
            staleTime: 5 * 60 * 1000, // 5 minutes
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  // Non-blocking prefetch of all view counts on app start
  useEffect(() => {
    // Use setTimeout to ensure this doesn't block the initial render
    const prefetchTimer = setTimeout(() => {
      prefetchAllViewCounts(queryClient);
    }, 0);

    return () => clearTimeout(prefetchTimer);
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
