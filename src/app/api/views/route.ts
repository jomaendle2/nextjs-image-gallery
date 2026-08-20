import { type NextRequest, NextResponse } from "next/server";
import {
  getAllViewCounts,
  getViewCount,
  incrementViewCount,
} from "@/lib/database";
import { isProduction } from "@/lib/deployment";
import { clientIp, createLimiter } from "@/lib/rate-limit";

/**
 * Generous, because browsing is the point: a visitor stepping through a
 * fourteen-photograph gallery legitimately posts fourteen times, and may
 * come back. This is here to make automated inflation tedious, not to
 * ration reading.
 */
const viewLimiter = createLimiter(240);

/**
 * The same photograph, from the same address, a small number of times.
 *
 * The client already declines to re-count a photograph it has seen in the
 * last six hours — but that guard is a `localStorage` stamp, so it is worth
 * exactly what the reader chooses to let it be worth, and it is absent by
 * design in private browsing. A dedup that only exists in the browser is a
 * request-saver, not a rule. This is the tier where the rule holds.
 *
 * Three rather than one, and the difference matters. Keying by address means
 * a household, an office and a phone network share a bucket, and refusing
 * the second person behind a NAT would trade over-counting for the worse
 * failure of not counting somebody who really did look. Three absorbs that
 * while still turning a held refresh key into three views instead of two
 * hundred and forty.
 *
 * Six hours to match `VIEW_COOLDOWN_MS` in `useViewCount.ts`, so the two
 * tiers agree about what "again" means.
 */
const VIEW_DEDUP_HOURS = 6;
const repeatLimiter = createLimiter(3, VIEW_DEDUP_HOURS * 60 * 60 * 1000);

/**
 * A bound on the input, not a description of an id.
 *
 * Deliberately loose. New photographs get 12-character nanoids, but the
 * fourteen imported from the original static gallery kept their numeric ids
 * — `"1"` through `"14"`, and they hold every view this site has ever
 * counted. A regex tight enough to describe a nanoid would have rejected all
 * of them and quietly switched view counting off for the entire gallery.
 *
 * What actually stops a caller inventing rows is the `WHERE EXISTS` against
 * `photos` in `incrementViewCount`. This is only here so that obvious junk
 * — a path, a paragraph — costs a regex instead of a database round trip.
 */
const PHOTO_ID = /^[A-Za-z0-9_-]{1,64}$/;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    if (!viewLimiter.check(clientIp(request.headers))) {
      return NextResponse.json(
        { error: "Too many requests." },
        { status: 429 },
      );
    }

    const { imageId }: { imageId?: unknown } = await request.json();

    if (typeof imageId !== "string" || !PHOTO_ID.test(imageId)) {
      return NextResponse.json({ error: "Invalid image id." }, { status: 400 });
    }

    /*
     * Already counted recently from this address: answer with the current
     * total rather than an error. The caller is showing a number, not
     * performing a transaction, and a 429 here would make a refresh look
     * broken to somebody who did nothing wrong.
     *
     * A single-row read, not `getAllViewCounts`. The first version of this
     * reached for the whole joined table and picked one row out of it, which
     * made declining to count a photograph cost strictly more than counting
     * it — the opposite of the point, and worst for exactly the held refresh
     * key this exists to blunt.
     */
    if (!repeatLimiter.check(`${clientIp(request.headers)}:${imageId}`)) {
      return NextResponse.json({
        viewCount: await getViewCount(imageId),
        success: true,
      });
    }

    /*
     * Not production: answer with the real total and write nothing.
     *
     * Preview, development and production all point at the same Neon
     * database — the trap `EnvironmentBanner` exists to announce, and it does
     * not stop at the buttons. Reading changes nothing about a photograph,
     * but it does change its number, so every pass through a gallery on
     * `localhost` while building something, and every click on a preview link
     * shared for review, was landing in the count a photographer sees. That
     * is a quieter failure than a deleted row and a harder one to undo,
     * because nothing records which of the views were real.
     *
     * The refusal takes the same shape as the repeat-limiter branch above,
     * and for the same reason — the caller is showing a number, not
     * performing a transaction, so it should be indistinguishable from a
     * success to everything except the count itself. Returning zero would put
     * a wrong number on a developer's screen and make the feature look broken
     * locally.
     *
     * Deliberately on the server rather than in `useViewCount`. The client
     * cannot be told which environment it is in without a `NEXT_PUBLIC_*`
     * variable baked into the bundle, and a count is a claim about how many
     * people looked — the tier that decides it should be the one nobody can
     * edit.
     */
    if (!isProduction()) {
      return NextResponse.json({
        viewCount: await getViewCount(imageId),
        success: true,
      });
    }

    /*
     * Zero comes back for an id that matches no photograph — and also for a
     * database error, which `incrementViewCount` swallows by design. Since
     * the two are indistinguishable here, both answer 200 with a count of
     * zero rather than inventing a 404 that would be wrong half the time.
     * Nothing was written either way; the client simply shows no number.
     */
    const viewCount = await incrementViewCount(imageId);
    return NextResponse.json({ viewCount, success: true });
  } catch (error) {
    console.error("Error in view count API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/** Every count the gallery can display. Cached at the edge; see below. */
export async function GET(): Promise<NextResponse> {
  try {
    const data = await getAllViewCounts();

    return NextResponse.json(
      { viewCounts: data, success: true },
      {
        headers: {
          // View counts are ambient, not authoritative. Letting the CDN serve
          // a slightly stale copy while it revalidates keeps this off the
          // database for most visitors.
          "Cache-Control":
            "public, s-maxage=60, stale-while-revalidate=300, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("Error getting view counts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
