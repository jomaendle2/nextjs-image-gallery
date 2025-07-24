import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get("title") || "the beauty of earth.";

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "black",
            backgroundSize: "cover",
            backgroundPosition: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "flex-start",
              padding: "60px",
              textAlign: "start",
              backgroundColor: "rgba(0, 0, 0, 0.4)",
              borderRadius: "32px",
              border: "2px solid rgba(255, 255, 255, 0.2)",
              maxWidth: "900px",
              margin: "0 12px",
              gap: "16px",
              boxShadow: "0 32px 64px rgba(0, 0, 0, 0.3)",
            }}
          >
            <h1
              style={{
                fontSize: "96px",
                fontWeight: "800",
                color: "white",
                lineHeight: "0.9",
                margin: "0 0 32px 0",
                textShadow: "4px 4px 8px rgba(0, 0, 0, 0.8)",
                letterSpacing: "-4px",
              }}
            >
              {title}
            </h1>
            <p
              style={{
                fontSize: "32px",
                color: "rgba(255, 255, 255, 0.9)",
                margin: "16px 0 0 0",
                fontWeight: "400",
                textAlign: "start",
                textShadow: "2px 2px 4px rgba(0, 0, 0, 0.8)",
              }}
            >
              Explore the beauty of our planet 🌍
            </p>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    );
  } catch (e: any) {
    console.log(`${e.message}`);
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}
