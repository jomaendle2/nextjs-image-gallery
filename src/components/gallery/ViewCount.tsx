"use client";

import NumberFlow from "@number-flow/react";
import { Eye } from "lucide-react";
import { useEffect, useRef } from "react";
import { useViewCount } from "@/hooks/useViewCount";

interface ViewCountProps {
  imageId: number;
  variant?: "gallery" | "modal";
  className?: string;
  shouldIncrement?: boolean;
}

export function ViewCount({
  imageId,
  variant = "gallery",
  className = "",
  shouldIncrement = true,
}: ViewCountProps) {
  const { viewCount, incrementView } = useViewCount(imageId);

  // This component is reused across images rather than remounted per image,
  // so the guard has to be per image id, not per mount.
  const incrementedIds = useRef(new Set<number>());
  // Held in a ref so the effect can call the latest version without listing
  // it as a dependency and re-firing on every render.
  const incrementViewRef = useRef(incrementView);
  incrementViewRef.current = incrementView;
  const shouldIncrementRef = useRef(shouldIncrement);
  shouldIncrementRef.current = shouldIncrement;

  useEffect(() => {
    if (!(imageId && shouldIncrementRef.current)) {
      return;
    }
    if (incrementedIds.current.has(imageId)) {
      return;
    }

    incrementedIds.current.add(imageId);
    incrementViewRef.current().catch((error: unknown) => {
      // Allow a later visit to retry.
      incrementedIds.current.delete(imageId);
      console.error("Failed to increment view count:", error);
    });
  }, [imageId]);

  const isModal = variant === "modal";

  return (
    <div
      className={`flex items-center text-left gap-1.5 motion-opacity-in ${className}`}
    >
      <Eye
        aria-hidden="true"
        className={`${isModal ? "text-white/60" : "text-white/50"} transition-colors`}
        size={isModal ? 16 : 14}
      />
      <span
        className={`${
          isModal
            ? "text-sm text-white/80 font-medium"
            : "text-xs text-white/60 font-medium"
        } transition-colors tabular-nums flex items-center gap-1 min-w-[60px]`}
      >
        <NumberFlow value={viewCount} />
        {viewCount === 1 ? "view" : "views"}
      </span>
    </div>
  );
}
