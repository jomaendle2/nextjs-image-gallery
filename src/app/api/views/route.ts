import { NextRequest, NextResponse } from "next/server";
import { incrementViewCount, initDatabase } from "@/lib/database";

export async function POST(request: NextRequest) {
  try {
    // Initialize database on first request
    await initDatabase();

    const { imageId } = await request.json();

    console.log("Received imageId:", imageId);

    if (!imageId) {
      return NextResponse.json(
        { error: "Image ID is required" },
        { status: 400 },
      );
    }

    const viewCount = await incrementViewCount(imageId);

    console.log("Updated view count for imageId:", imageId, "to", viewCount);

    return NextResponse.json({
      viewCount,
      success: true,
    });
  } catch (error) {
    console.error("Error in view count API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
