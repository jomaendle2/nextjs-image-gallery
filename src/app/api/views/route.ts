import { type NextRequest, NextResponse } from "next/server";
import { getAllViewCounts, incrementViewCount } from "@/lib/database";
import { clientIp, createLimiter } from "@/lib/rate-limit";

/**
 * Generous, because browsing is the point: a visitor stepping through a
 * fourteen-photograph gallery legitimately posts fourteen times, and may
 * come back. This is here to make automated inflation tedious, not to
 * ration reading.
 */
const viewLimiter = createLimiter(240, 15 * 60 * 1000);

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
