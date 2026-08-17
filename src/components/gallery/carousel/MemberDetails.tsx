"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { ReactNode } from "react";
import { META } from "@/components/ui/field";
import { glassControl } from "@/components/ui/glass-button";

interface Details {
  member: boolean;
  precise_location?: string | null;
  technique?: string | null;
}

/*
 * The one fact that outlives any single photograph.
 *
 * `member` is a property of the session, but it arrives bundled into a
 * per-photograph response — so the component kept re-learning it from
 * scratch on every swipe to a photograph it had not fetched yet, and the
 * invitation blinked out for the length of a round trip each time.
 * `keepPreviousData` did not cover that case: it bridges consecutive
 * fetches of one query observer, not first visits to new photographs.
 *
 * So the flag is kept here, at module scope, written by every successful
 * fetch. While a photograph's own answer is in flight, a known non-member
 * still gets the invitation instantly; a known member gets the held blank
 * line, because their content belongs to one photograph and must not be
 * guessed. Module scope is deliberate — the value should live exactly as
 * long as the tab, same as the query cache beside it.
 */
let sessionIsMember: boolean | null = null;

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
  const { data, isPlaceholderData } = useQuery({
    queryKey: ["photoDetails", photoId],
    queryFn: async (): Promise<Details> => {
      const response = await fetch(`/api/photo/${photoId}/details`);
      if (response.status === 403) {
        sessionIsMember = false;
        return { member: false };
      }
      if (!response.ok) {
        throw new Error("Could not load the details.");
      }
      const details = (await response.json()) as Details;
      sessionIsMember = details.member;
      return details;
    },
    staleTime: 5 * 60 * 1000,
    // A failed lookup should not retry three times behind a photograph.
    retry: false,
    /*
     * Once the session is known to be a non-member, stop asking. The route
     * answers 403 for every photograph alike, so each further swipe was one
     * more request whose answer was already known — and one more red
     * "403 (Forbidden)" in the console, which reads as breakage when it is
     * the gate doing its job. One refusal per session is the gate working;
     * sixteen is noise. Becoming a member goes through Stripe's redirect,
     * which reloads the page and resets this module, so the flag cannot go
     * stale within a session.
     */
    enabled: sessionIsMember !== false,
    /*
     * Carry the previous photograph's answer across the switch, so the
     * query key changing does not unmount everything for the length of a
     * round trip. Whether it is *safe to show* is decided below — stale
     * membership status is fine, a stale location is not.
     */
    placeholderData: keepPreviousData,
  });

  const shown = whatToShow(data, isPlaceholderData);

  return body(shown);
}

/**
 * Which answer may be displayed, given one that might belong to the previous
 * photograph.
 *
 * The two cases differ because the two fields differ in what they describe.
 * Membership is a property of the session, so a stale `member` flag is still
 * true or false for this photograph and the invitation can stay put rather
 * than blinking on every swipe. A location belongs to one photograph, and
 * showing the previous one's under the next — even for a tenth of a second —
 * would be quietly wrong in the one place this site promises precision.
 *
 * Its own function because the inline version had grown into a condition
 * mixing an object with a boolean, and this file has already been the site
 * of one subtle bug that read as deliberate.
 */
function whatToShow(
  data: Details | undefined,
  isStale: boolean,
): Details | undefined {
  if (data !== undefined && !isStale) {
    return data;
  }
  // Stale: safe for a non-member's invitation, never for a member's location.
  if (data !== undefined && !data.member) {
    return data;
  }
  /*
   * Nothing usable for this photograph yet — first visit, or a member's
   * stale answer. The session still knows whether this person is a member,
   * and for a non-member that is the whole message: the invitation does not
   * depend on the photograph at all, so it renders immediately instead of
   * blinking out for a round trip on every first visit.
   */
  return sessionIsMember === false ? { member: false } : undefined;
}

function body(data: Details | undefined): ReactNode {
  if (data === undefined) {
    return null;
  }

  if (!data.member) {
    return (
      <div>
        <p className={META}>Where exactly, and how</p>
        <p className="mt-1.5 text-[0.9375rem] text-white/60 leading-relaxed">
          The photographer wrote down the spot and how the picture was made.
          Members can read it.
        </p>
        <Link
          className={glassControl(
            "mt-3 inline-flex min-h-11 items-center px-4 py-2 text-sm text-white/85 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80",
          )}
          href="/membership"
        >
          See what a membership shows
        </Link>
      </div>
    );
  }

  const location = data.precise_location?.trim() ?? "";
  const technique = data.technique?.trim() ?? "";

  // A member is entitled to know there is nothing to know.
  if (location === "" && technique === "") {
    return (
      <div>
        <p className={META}>Where exactly, and how</p>
        <p className="mt-1.5 text-[0.9375rem] text-white/50 leading-relaxed">
          The photographer has not written anything for this one.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {location === "" ? null : (
        <div>
          <p className={META}>Where exactly</p>
          <p className="mt-1.5 text-[0.9375rem] text-white/85 leading-relaxed">
            {location}
          </p>
        </div>
      )}
      {technique === "" ? null : (
        <div>
          <p className={META}>How it was made</p>
          <p className="mt-1.5 text-pretty text-[0.9375rem] text-white/85 leading-relaxed">
            {technique}
          </p>
        </div>
      )}
    </div>
  );
}
