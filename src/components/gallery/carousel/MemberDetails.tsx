"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

interface Details {
  member: boolean;
  precise_location?: string | null;
  technique?: string | null;
}

/**
 * Where a photograph was taken and how, for members.
 *
 * Fetched rather than rendered from props, because the page it sits on is
 * statically cached and the same HTML is served to everybody. The gate is in
 * the route, not here — this component decides what to *show*, and the
 * server decides what to *send*. If this file were deleted, the data would
 * still be unreachable without a subscription.
 *
 * React Query is already carrying view counts, so the request is deduped and
 * cached per photograph for the session rather than refetched every time the
 * carousel moves and back.
 */
export function MemberDetails({ photoId }: { photoId: string }) {
  const { data, isPending } = useQuery({
    queryKey: ["photoDetails", photoId],
    queryFn: async (): Promise<Details> => {
      const response = await fetch(`/api/photo/${photoId}/details`);
      if (response.status === 403) {
        return { member: false };
      }
      if (!response.ok) {
        throw new Error("Could not load the details.");
      }
      return (await response.json()) as Details;
    },
    staleTime: 5 * 60 * 1000,
    // A failed lookup should not retry three times behind a photograph.
    retry: false,
  });

  /*
   * Nothing at all until the answer is known. A placeholder that resolves
   * into an invitation would be a second thing moving in a bar this codebase
   * spent a long time making immovable.
   */
  if (isPending || data === undefined) {
    return null;
  }

  if (!data.member) {
    return (
      <Link
        className="-my-3 inline-flex min-h-11 items-center rounded-full py-3 text-[0.6875rem] text-white/35 uppercase tracking-[0.14em] transition-colors hover:text-white/70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80"
        href="/membership"
      >
        Members see where this was taken
      </Link>
    );
  }

  const location = data.precise_location?.trim() ?? "";
  const technique = data.technique?.trim() ?? "";

  // A member is entitled to know there is nothing to know.
  if (location === "" && technique === "") {
    return (
      <p className="text-[0.6875rem] text-white/30 uppercase tracking-[0.14em]">
        No location given
      </p>
    );
  }

  return (
    <div className="max-w-prose space-y-1 text-left lg:text-right">
      {location === "" ? null : (
        <p className="text-[0.6875rem] text-white/55 uppercase tracking-[0.14em]">
          {location}
        </p>
      )}
      {technique === "" ? null : (
        <p className="text-pretty text-[0.75rem] text-white/45 leading-relaxed">
          {technique}
        </p>
      )}
    </div>
  );
}
