import { type NextRequest, NextResponse } from "next/server";
import {
  getAllViewCounts,
  incrementViewCount,
  initDatabase,
} from "@/lib/database";

export async function POST(request: NextRequest) {
  try {
    await initDatabase();

    const { imageId }: { imageId?: string | number } = await request.json();

    if (!imageId) {
      return NextResponse.json(
        { error: "Image ID is required" },
        { status: 400 },
      );
    }

    const viewCount = await incrementViewCount(String(imageId));

    return NextResponse.json({ viewCount, success: true });
  } catch (error) {
    console.error("Error in view count API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// on GET, return all view counts
export async function GET() {
  try {
    await initDatabase();

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
