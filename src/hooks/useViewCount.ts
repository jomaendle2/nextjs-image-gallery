"use client";

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useCallback } from "react";

interface UseViewCountReturn {
  viewCount: number;
  incrementView: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

// Query key factory
const viewCountKeys = {
  all: ["viewCount"] as const,
  byId: (imageId: number) => [...viewCountKeys.all, imageId] as const,
};

// Fetch function for view count
const fetchViewCount = async (imageId: number): Promise<number> => {
  const response = await fetch(`/api/views/${encodeURIComponent(imageId)}`);

  if (!response.ok) {
    throw new Error("Failed to fetch view count");
  }

  const data = await response.json();
  return data.viewCount || 0;
};

// Increment view count function
const incrementViewCount = async (imageId: number): Promise<number> => {
  const response = await fetch("/api/views", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ imageId }),
  });

  if (!response.ok) {
    throw new Error("Failed to increment view count");
  }

  const data = await response.json();
  return data.viewCount || 0;
};

export function useViewCount(imageId: number): UseViewCountReturn {
  const queryClient = useQueryClient();

  // Query for fetching view count with 5-minute stale time
  const {
    data: viewCount = 0,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: viewCountKeys.byId(imageId),
    queryFn: () => fetchViewCount(imageId),
    enabled: !!imageId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Mutation for incrementing view count
  const incrementMutation = useMutation({
    mutationFn: () => incrementViewCount(imageId),
    onSuccess: (newViewCount) => {
      // Update the query cache with the new view count
      queryClient.setQueryData(viewCountKeys.byId(imageId), newViewCount);
    },
    onError: () => {
      // Optimistic update on error - increment the cached value
      queryClient.setQueryData(
        viewCountKeys.byId(imageId),
        (old: number = 0) => old + 1,
      );
    },
  });

  const incrementView = useCallback(async () => {
    await incrementMutation.mutateAsync();
  }, [incrementMutation]);

  return {
    viewCount,
    incrementView,
    isLoading: isLoading || incrementMutation.isPending,
    error: queryError?.message || incrementMutation.error?.message || null,
  };
}
