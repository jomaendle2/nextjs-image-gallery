import { NextRequest, NextResponse } from "next/server";
import { getViewCount } from "@/lib/database";

export async function GET(
  request: NextRequest,
  { params }: { params: { imageId: string } },
) {
  try {
    const { imageId } = await params;

    if (!imageId) {
      return NextResponse.json(
        { error: "Image ID is required" },
        { status: 400 },
      );
    }

    const viewCount = await getViewCount(imageId);

    return NextResponse.json({
      viewCount,
      success: true,
    });
  } catch (error) {
    console.error("Error getting view count:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
