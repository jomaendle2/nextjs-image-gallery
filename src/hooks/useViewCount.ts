"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

const STALE_TIME_MS = 5 * 60 * 1000;

/**
 * Photo ids are nanoids. Rows written before contributors existed carry the
 * old numeric ids, so both shapes have to compare equal — see `sameId`.
 */
interface ViewCountRow {
  image_id: string | number;
  view_count: number;
}

interface UseViewCountReturn {
  viewCount: number;
  incrementView: () => Promise<void>;
}

/** One key for the whole table: every count arrives in a single request. */
const VIEW_COUNTS = ["viewCount"] as const;

const incrementViewCount = async (imageId: string): Promise<number> => {
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

/*
 * `prefetchAllViewCounts` used to live here, called once from
 * `QueryProvider`'s mount effect. It is gone because it never did anything:
 * `ViewCount` renders on first paint and `useQuery` below declares the same
 * `queryKey`, `queryFn` and `staleTime`, so React Query recognised the two
 * as one query and threw away the second. A prefetch is only worth having
 * for data that is *not* about to be asked for.
 */

export function useViewCount(imageId: string): UseViewCountReturn {
  const queryClient = useQueryClient();

  const { data: viewCount = 0 } = useQuery({
    queryKey: VIEW_COUNTS,
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
      queryClient.setQueryData<ViewCountRow[]>(VIEW_COUNTS, (rows = []) => {
        const existing = rows.find((row) => sameId(row.image_id, imageId));
        if (!existing) {
          return [...rows, { image_id: imageId, view_count: nextCount }];
        }
        return rows.map((row) =>
          sameId(row.image_id, imageId)
            ? { ...row, view_count: nextCount }
            : row,
        );
      });
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

  return { viewCount, incrementView };
}

/**
 * Records that a photograph was looked at. Renders nothing, shows nothing.
 *
 * This used to live inside `ViewCount`, which was fine while the count was
 * displayed under the photograph it counted. It stopped being fine when the
 * count moved into the details panel: the write would then only have happened
 * when somebody opened the panel, so the number would have measured panel
 * opens and called them views.
 *
 * The guard is keyed by image id rather than by mount, because the carousel
 * reuses one instance across every photograph — a per-mount flag would count
 * the first photograph and nothing after it.
 */
export function useRecordView(imageId: string): void {
  const { incrementView } = useViewCount(imageId);

  const recorded = useRef(new Set<string>());
  // Held in a ref so the effect can call the current version without listing
  // it as a dependency and re-firing on every render.
  const incrementRef = useRef(incrementView);
  incrementRef.current = incrementView;

  useEffect(() => {
    if (!imageId || recorded.current.has(imageId)) {
      return;
    }
    recorded.current.add(imageId);
    incrementRef.current().catch((error: unknown) => {
      // Allow a later visit to retry.
      recorded.current.delete(imageId);
      console.error("Failed to increment view count:", error);
    });
  }, [imageId]);
}
