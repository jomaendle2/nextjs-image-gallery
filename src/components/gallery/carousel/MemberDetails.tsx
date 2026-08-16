"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { ReactNode } from "react";

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

  /*
   * What may be shown while the new photograph's answer is in flight.
   *
   * Membership is a property of the session, not of the photograph, so the
   * previous answer's `member` flag is still true or false for this one —
   * which means a non-member's invitation can stay put across every switch
   * instead of blinking out and in for ~100ms per swipe. That blink was the
   * "short layout shift while loading": the link unmounted while the next
   * fetch ran, the held line under it was 4px shorter than the link's
   * resting height, and the photograph absorbed the difference.
   *
   * The location and technique are the opposite case: they belong to one
   * photograph, and showing the previous photograph's location under the
   * next one — even for a tenth of a second — would be quietly wrong in the
   * one place this site promises precision. So for members the text is
   * blanked during the fetch and only the line's height is held.
   */
  const shown = whatToShow(data, isPlaceholderData);

  return <Line>{body(shown)}</Line>;
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

/**
 * Holds the line whether or not there is anything to put on it.
 *
 * This used to return `null` while the request was in flight, on the
 * reasoning that a placeholder resolving into an invitation would be one
 * more thing moving in a bar this codebase worked hard to make still. That
 * had it backwards: rendering nothing and then something *is* the movement,
 * and because the lookup is per photograph it happened on every single image
 * change — the caption bar grew by a line a moment after each one, and the
 * photograph above absorbed the difference.
 *
 * The exif line two elements up already solved this, with an empty paragraph
 * holding `min-h-4` and a comment describing the identical bug. Same idiom
 * here — but the first attempt reserved `min-h-5` for a link that actually
 * rests at 24.3px, because an inline-flex child sits on a text baseline and
 * the parent's line-box strut adds ~4px beyond the margin box. That missing
 * 4px was still a visible jump on every swipe. `flex` removes the strut:
 * the child's 44px touch target is pulled back to exactly 20px by its
 * negative margins, matching the reservation, so empty and full are now the
 * same height to the pixel.
 */
function Line({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-5 items-center justify-center lg:justify-end">
      {children}
    </div>
  );
}

function body(data: Details | undefined): ReactNode {
  if (data === undefined) {
    return null;
  }

  if (!data.member) {
    return (
      <Link
        className="-my-3 inline-flex min-h-11 items-center rounded-full py-3 text-[0.6875rem] text-white/55 uppercase tracking-[0.14em] transition-colors hover:text-white/70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80"
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
      <p className="text-[0.6875rem] text-white/50 uppercase tracking-[0.14em]">
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
        <p className="text-pretty text-[0.75rem] text-white/55 leading-relaxed">
          {technique}
        </p>
      )}
    </div>
  );
}
