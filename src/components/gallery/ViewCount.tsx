"use client";

import { Eye } from "lucide-react";
import { useViewCount } from "@/hooks/useViewCount";
import { useEffect, useRef } from "react";

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
  const { viewCount, incrementView, isLoading } = useViewCount(imageId);
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

  const formatViewCount = (count: number): string => {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
      compactDisplay: "short",
    }).format(count);
  };

  if (isLoading && viewCount === 0) {
    return (
      <div
        className={`flex items-center text-left gap-1.5 motion-opacity-in ${className}`}
      >
        <Eye size={variant === "modal" ? 16 : 14} className="opacity-50" />
        <span
          className={`${
            variant === "modal" ? "text-sm" : "text-xs"
          } opacity-50 animate-pulse min-w-[60px]`}
        >
          — views
        </span>
      </div>
    );
  }

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
        } transition-colors tabular-nums min-w-[60px]`}
      >
        {formatViewCount(viewCount)} {viewCount === 1 ? "view" : "views"}
      </span>
    </div>
  );
}
