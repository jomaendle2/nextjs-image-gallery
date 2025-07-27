"use client";

import { Eye } from "lucide-react";
import { useViewCount } from "@/hooks/useViewCount";
import { useEffect, useRef } from "react";
import NumberFlow from "@number-flow/react";

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
  const hasIncremented = useRef(new Map<number, boolean>());

  // Increment view count when component mounts (only once per image)
  useEffect(() => {
    if (!hasIncremented.current.get(imageId) && imageId && shouldIncrement) {
      incrementView()
        .then(() => {
          hasIncremented.current.set(imageId, true);
        })
        .catch((error) => {
          console.error("Failed to increment view count:", error);
        });
    }
  }, [imageId]); // Removed incrementView from dependencies to prevent infinite loop

  return (
    <div
      className={`flex items-center text-left gap-1.5 motion-opacity-in ${className}`}
    >
      <Eye
        size={variant === "modal" ? 16 : 14}
        className={`${
          variant === "modal" ? "text-white/60" : "text-white/50"
        } transition-colors`}
      />
      <span
        className={`${
          variant === "modal"
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
