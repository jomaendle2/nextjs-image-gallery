import { NextResponse } from "next/server";
import { getViewCount } from "@/lib/database";

/**
 * The same bound the write endpoint applies — loose on purpose, because the
 * imported photographs carry short numeric ids. See the note there.
 */
const PHOTO_ID = /^[A-Za-z0-9_-]{1,64}$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ imageId: string }> },
): Promise<NextResponse> {
  try {
    const { imageId } = await params;

    if (!PHOTO_ID.test(imageId)) {
      return NextResponse.json({ error: "Invalid image id." }, { status: 400 });
    }

    const viewCount = await getViewCount(imageId);

    return NextResponse.json({ viewCount, success: true });
  } catch (error) {
    console.error("Error getting view count:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
