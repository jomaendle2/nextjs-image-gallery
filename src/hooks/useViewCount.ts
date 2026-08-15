"use client";

import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";

const STALE_TIME_MS = 5 * 60 * 1000;

/** The API reports ids as strings; the gallery keys them as numbers. */
interface ViewCountRow {
  image_id: string | number;
  view_count: number;
}

interface UseViewCountReturn {
  viewCount: number;
  incrementView: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const viewCountKeys = {
  all: ["viewCount"] as const,
};

const incrementViewCount = async (imageId: number): Promise<number> => {
  const response = await fetch("/api/views", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageId }),
  });

  if (!response.ok) {
    throw new Error("Failed to increment view count");
  }

  const data: { viewCount?: number } = await response.json();
  return data.viewCount ?? 0;
};

const fetchAllViewCounts = async (): Promise<ViewCountRow[]> => {
  const response = await fetch("/api/views");
  if (!response.ok) {
    throw new Error("Failed to fetch all view counts");
  }
  const data: { viewCounts?: ViewCountRow[] } = await response.json();
  return data.viewCounts ?? [];
};

const sameId = (a: string | number, b: string | number) =>
  String(a) === String(b);

export function prefetchAllViewCounts(queryClient: QueryClient) {
  return queryClient.prefetchQuery({
    queryKey: viewCountKeys.all,
    queryFn: fetchAllViewCounts,
    staleTime: STALE_TIME_MS,
  });
}

export function useViewCount(imageId: number): UseViewCountReturn {
  const queryClient = useQueryClient();

  const {
    data: viewCount = 0,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: viewCountKeys.all,
    queryFn: fetchAllViewCounts,
    // `select` previously returned undefined for an image with no row yet,
    // which the return type claimed was a number.
    select: (rows: ViewCountRow[]) =>
      rows.find((row) => sameId(row.image_id, imageId))?.view_count ?? 0,
    staleTime: STALE_TIME_MS,
  });

  /**
   * Writes the server's new total back into the list this hook actually
   * reads from. The previous version wrote to a `["viewCount", imageId]`
   * key that nothing subscribed to, so a successful increment never showed
   * up in the UI until the 5 minute stale window expired.
   */
  const writeCount = useCallback(
    (nextCount: number) => {
      queryClient.setQueryData<ViewCountRow[]>(
        viewCountKeys.all,
        (rows = []) => {
          const existing = rows.find((row) => sameId(row.image_id, imageId));
          if (!existing) {
            return [...rows, { image_id: imageId, view_count: nextCount }];
          }
          return rows.map((row) =>
            sameId(row.image_id, imageId)
              ? { ...row, view_count: nextCount }
              : row,
          );
        },
      );
    },
    [queryClient, imageId],
  );

  const incrementMutation = useMutation({
    mutationFn: () => incrementViewCount(imageId),
    onSuccess: writeCount,
  });

  const { mutateAsync } = incrementMutation;
  const incrementView = useCallback(async () => {
    await mutateAsync();
  }, [mutateAsync]);

  return {
    viewCount,
    incrementView,
    isLoading: isLoading || incrementMutation.isPending,
    error: queryError?.message ?? incrementMutation.error?.message ?? null,
  };
}
