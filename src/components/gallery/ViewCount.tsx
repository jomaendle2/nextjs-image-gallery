"use client";

import NumberFlow from "@number-flow/react";
import { Eye } from "lucide-react";
import { useEffect, useRef } from "react";
import { useViewCount } from "@/hooks/useViewCount";

interface ViewCountProps {
  imageId: string;
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
  const incrementedIds = useRef(new Set<string>());
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
        } flex items-center gap-1 tabular-nums transition-colors`}
      >
        {/*
          A fixed box for the digits, not a minimum for the whole phrase.

          The counter sits in a centred column on a phone, so anything that
          changes its width re-centres the row and drags the icon and the
          word sideways with it. That happened several times per photograph,
          not once: NumberFlow animates from the old value to the new one, so
          a count crossing a digit boundary grew the box on its way past.

          `tabular-nums` makes every digit exactly `1ch`, so a fixed six
          characters holds every count up to `99,999` — grouping separator
          included — and right-aligning them keeps the word beside it still
          while the number changes underneath. A photograph past six figures
          would start moving the row again; that is a good problem, and the
          fix is one character here.
        */}
        <span className="inline-block w-[6ch] text-right">
          <NumberFlow value={viewCount} />
        </span>
        {viewCount === 1 ? "view" : "views"}
      </span>
    </div>
  );
}
