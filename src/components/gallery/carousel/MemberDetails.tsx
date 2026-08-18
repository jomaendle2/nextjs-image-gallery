"use client";

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { META } from "@/components/ui/field";
import { glassControl } from "@/components/ui/glass-button";
import {
  mayDisplayStale,
  nextSessionAccess,
  type PhotoAccess,
  showsTeaser,
} from "@/lib/members/access";
import { useMembershipOffered } from "../MembershipOffer";

interface Details {
  /**
   * Why this reader is seeing what they are seeing.
   *
   * This was `member: boolean` and could not stay one. A photographer
   * reading their own notes is not a member, and answering `true` would have
   * been a lie the client then cached as a *session* fact — one look at
   * their own photograph and every other photograph in the tab would hold a
   * blank line waiting for content that was never coming.
   */
  access: PhotoAccess;
  /**
   * Whether anybody is signed in at all, sent with a refusal.
   *
   * Only meaningful on a 403. See `nextSessionAccess`: a refusal settles the
   * session only for somebody who is not signed in.
   */
  signedIn?: boolean;
  precise_location?: string | null;
  technique?: string | null;
  /**
   * The exact point, when the photographer marked one and kept it.
   *
   * Null both when nothing was marked and when they published the blurred
   * dot only — from here those are the same fact: there is no point to show.
   *
   * Raw numbers rather than a rendered map. This response is
   * `private, no-store` and per request, so anything precomputed on the
   * server would be recomputed for every member for nothing; and an SVG
   * string in JSON invites `dangerouslySetInnerHTML` into the one route that
   * handles paid data.
   */
  pin?: { lat: number; lng: number } | null;
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
 * So the flag is kept outside any one photograph's query, written by every
 * answer the route gives. While a photograph's own details are in flight, a
 * known non-member still gets the invitation instantly; a known member gets
 * the held blank line, because their content belongs to one photograph and
 * must not be guessed.
 *
 * It lives in the query cache rather than in a `let` at module scope, which
 * is where it started. That version was read during render to decide
 * `enabled`, and mutable module state read during render is the thing React's
 * concurrent renderer is allowed to break: two components rendering in one
 * pass can see different values, and nothing tells a component that the
 * value changed, so a mounted panel could keep asking after the session was
 * known to be anonymous. The cache is the same lifetime — exactly as long as
 * the tab — and it is *subscribed*, so every panel sees one value and
 * re-renders when it lands.
 */
const SESSION_MEMBER_KEY = ["session", "member"] as const;

/**
 * Whether this session is known to hold a membership: `true`, `false`, or
 * `null` for "nobody has asked yet".
 *
 * A query that never fetches — `enabled: false` and a `queryFn` that would
 * throw if it ever ran. It exists purely as a subscription to a value the
 * details query writes, which is the documented way to share state that has
 * no endpoint of its own with the cache doing the notifying.
 */
function useSessionIsMember(): boolean | null {
  const { data } = useQuery<boolean | null>({
    queryKey: SESSION_MEMBER_KEY,
    queryFn: () => {
      throw new Error("The session flag is written, never fetched.");
    },
    enabled: false,
    initialData: null,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  });
  return data;
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
  const client = useQueryClient();
  const sessionIsMember = useSessionIsMember();
  const membershipOffered = useMembershipOffered();

  const { data, isPlaceholderData, isError } = useQuery({
    queryKey: ["photoDetails", photoId],
    queryFn: async (): Promise<Details> => {
      const response = await fetch(`/api/photo/${photoId}/details`);
      if (response.status === 403) {
        const refusal = (await response.json()) as Details;
        /*
         * A refusal, and whether it is final. `nextSessionAccess` returns
         * null for a signed-in reader, which leaves the flag unknown and the
         * query enabled — the next photograph may be one of theirs.
         */
        const settled = nextSessionAccess("none", refusal.signedIn === true);
        if (settled !== null) {
          client.setQueryData(SESSION_MEMBER_KEY, settled);
        }
        return { access: "none" };
      }
      if (!response.ok) {
        throw new Error("Could not load the details.");
      }
      const details = (await response.json()) as Details;
      const settled = nextSessionAccess(details.access, true);
      if (settled !== null) {
        client.setQueryData(SESSION_MEMBER_KEY, settled);
      }
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
     * which reloads the page and empties the cache, so the flag cannot go
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
   * A failure is the one state that must not be silent.
   *
   * `retry: false` plus a `null` render meant a paying member whose request
   * failed — a dropped connection, a 500, a rate limit — saw the row simply
   * not be there, indistinguishable from a photograph with no notes. They had
   * paid for this, and the site's answer was a gap. `PhotoDetails` renders
   * this row only where something exists, so an empty space here is now
   * provably wrong rather than merely ambiguous.
   */
  if (isError) {
    return (
      <div>
        <p className={META}>Where exactly, and how</p>
        <p className="mt-1.5 text-[0.9375rem] text-white/55 leading-relaxed">
          This did not load. Reloading the page will try again.
        </p>
      </div>
    );
  }

  return body(
    whatToShow(data, isPlaceholderData, sessionIsMember),
    membershipOffered,
  );
}

/**
 * Which answer may be displayed, given one that might belong to the previous
 * photograph.
 *
 * The two cases differ because the two fields differ in what they describe.
 * Membership is a property of the session, so a stale refusal is still a
 * refusal for this photograph and the invitation can stay put rather than
 * blinking on every swipe. `mayDisplayStale` draws that line, and it holds an
 * author's answer back exactly like a member's: both belong to one photograph. A location belongs to one photograph, and
 * showing the previous one's under the next — even for a tenth of a second —
 * would be quietly wrong in the one place this site promises precision.
 *
 * Its own function because the inline version had grown into a condition
 * mixing an object with a boolean, and this file has already been the site
 * of one subtle bug that read as deliberate.
 *
 * The session flag arrives as an argument rather than being read from the
 * enclosing module, which is what makes this a pure function of three values
 * and testable as one. It used to reach out for a `let`.
 */
function whatToShow(
  data: Details | undefined,
  isStale: boolean,
  sessionIsMember: boolean | null,
): Details | undefined {
  if (data !== undefined && !isStale) {
    return data;
  }
  // Stale: safe for a non-member's invitation, never for a member's location.
  if (data !== undefined && mayDisplayStale(data.access)) {
    return data;
  }
  /*
   * Nothing usable for this photograph yet — first visit, or a member's
   * stale answer. The session still knows whether this person is a member,
   * and for a non-member that is the whole message: the invitation does not
   * depend on the photograph at all, so it renders immediately instead of
   * blinking out for a round trip on every first visit.
   */
  return sessionIsMember === false ? { access: "none" } : undefined;
}

/**
 * The exact point, as numbers and a way to go there.
 *
 * Deliberately not a map. A member who paid to know where a photograph was
 * taken wants to *go* there, and another small picture of the world helps
 * with neither — the coarse dot in the panel above already answers "roughly
 * where". Numbers and a link are more useful, cost no new bytes, and add no
 * third party: a link somebody chooses to follow is not a request this page
 * makes.
 *
 * OpenStreetMap rather than Google, and styled exactly like the outbound
 * link to a photographer's own site a few rows up. No accent — this is the
 * viewer, and the only colour here comes from the photograph.
 *
 * Five places is about a metre, which is the precision the photographer
 * marked at and therefore the precision to show. Rounding it further would
 * be quietly substituting a different promise for the one they agreed to.
 */
function ExactPoint({ pin }: { pin: { lat: number; lng: number } }) {
  const osm = `https://www.openstreetmap.org/?mlat=${pin.lat}&mlon=${pin.lng}`;
  return (
    <p className="mt-1.5 text-[0.9375rem] text-white/85 leading-relaxed">
      <span className="tabular-nums">
        {`${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`}
      </span>
      <a
        className="-my-3 ml-3 inline-flex min-h-11 items-center gap-1 rounded-sm py-3 text-sm text-white/55 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80"
        href={osm}
        rel="noopener noreferrer nofollow"
        target="_blank"
      >
        Open the map
        <ArrowUpRight aria-hidden="true" size={13} />
      </a>
    </p>
  );
}

function body(data: Details | undefined, offered: boolean): ReactNode {
  if (data === undefined) {
    return null;
  }

  if (data.access === "none") {
    /*
     * Nothing on sale, nothing to sell.
     *
     * A photographer filling in "Where you stood" — the field `FirstRun`
     * spends a paragraph teaching them about — turned their own photograph
     * into an advertisement for a tier that does not exist, whose button led
     * to a page reading "Not open yet". The flag was already threaded into
     * this carousel and stopped at the top bar.
     */
    if (!showsTeaser(data.access, offered)) {
      return null;
    }

    return (
      <div>
        <p className={META}>Where exactly, and how</p>
        {/*
          A claim about the photograph in front of the reader, and now it is
          true of that photograph.

          This sentence has been through both failures. It began as an
          assertion — "the photographer wrote down the spot and how the picture
          was made" — under every photograph alike, on a gallery where all
          three member fields were empty on all fourteen published rows: an
          offer against a bare shelf, where the site asks for money. It was
          then softened into a claim about photographers in general, which was
          honest but sold nothing, and was marked as the stopgap it was.

          `PhotoDetails` now renders this row only where `hasMemberDetails` is
          true, so the concrete claim is back and earns its place.

          Two words are doing the work of a second bit, so that there is only
          one. "Recorded" is true of both acts the paid fields hold — typing a
          sentence and marking a point on a map — where "written down" was
          prose language for what is, on every photograph published so far, a
          coordinate. And the "or" is what one bit buys: what crosses into a
          public payload is that *something* exists, never which of the three
          fields it is, because a payload distinguishing them would be
          reporting on the paid columns field by field. Naming both
          possibilities and letting the reader find out which by joining is a
          smaller price than that.

          "Than the page shows" is there because "more" otherwise has nothing
          to be more than. The panel above it is the comparison.
        */}
        <p className="mt-1.5 text-[0.9375rem] text-white/60 leading-relaxed">
          The photographer recorded more about this one than the page shows:
          where exactly it was taken, or how the picture was made. Members can
          read it.
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
  const pin = data.pin ?? null;

  // A member is entitled to know there is nothing to know.
  if (location === "" && technique === "" && pin === null) {
    return (
      <div>
        <p className={META}>Where exactly, and how</p>
        <p className="mt-1.5 text-[0.9375rem] text-white/55 leading-relaxed">
          The photographer has not written anything for this one.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {location === "" && pin === null ? null : (
        <div>
          <p className={META}>Where exactly</p>
          {location === "" ? null : (
            <p className="mt-1.5 text-[0.9375rem] text-white/85 leading-relaxed">
              {location}
            </p>
          )}
          {pin === null ? null : <ExactPoint pin={pin} />}
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
