"use client";

import { Eye } from "lucide-react";
// biome-ignore lint/correctness/noUnresolvedImports: `Suspense` is a symbol rather than a function on React's export object, and Biome's resolver reads that as a missing export. `tsc --noEmit` resolves it, which is the authority on this.
import { lazy, Suspense } from "react";
import { useViewCount } from "@/hooks/useViewCount";

/**
 * The rolling-digit animation, fetched after the page rather than with it.
 *
 * `@number-flow/react` is 20KB gzipped — the largest thing on the gallery's
 * critical path that is not React itself, and it was arriving on `/` and
 * `/photo/[id]` in the same breath as the photograph, competing with the LCP
 * image for a phone's first connections.
 *
 * All it buys is an animation *between* two counts, and at first paint there
 * is no first count to animate from: `useViewCount` fetches it. So the roll
 * has nothing to do until well after the page is up, which is exactly the
 * shape of thing that belongs behind a split.
 *
 * **`lazy` and a `Suspense` fallback rather than `next/dynamic`.** The
 * distinction is the whole reason the split is free: `dynamic`'s `loading`
 * takes no props, so it can only render a blank while the chunk is in
 * flight — which would leave the word "views" standing next to nothing, and
 * would drop the count out of the server-rendered HTML entirely. A Suspense
 * fallback closes over `viewCount`, so the plain digits are what the server
 * sends and what the reader sees immediately, in the same fixed `6ch` box.
 * The animation then upgrades in underneath without moving anything.
 */
const RollingCount = lazy(() => import("@number-flow/react"));

interface ViewCountProps {
  imageId: string;
  variant?: "gallery" | "modal";
  className?: string;
}

/**
 * Displays a count. It does not record one — `useRecordView` does that, from
 * wherever the photograph is actually being looked at. The two were one
 * component until the count moved into the details panel, at which point
 * "shown" and "counted" stopped being the same event.
 */
export function ViewCount({
  imageId,
  variant = "gallery",
  className = "",
}: ViewCountProps) {
  const { viewCount } = useViewCount(imageId);

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
          <Suspense fallback={viewCount.toLocaleString()}>
            <RollingCount value={viewCount} />
          </Suspense>
        </span>
        {viewCount === 1 ? "view" : "views"}
      </span>
    </div>
  );
}
