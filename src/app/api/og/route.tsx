import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

// Runs on the default Node.js runtime (Fluid Compute): same regions and
// price as Edge, but with the full Node API surface available.

const WIDTH = 1200;
const HEIGHT = 630;

/** The ground, matching `--ground` in globals.css. */
const GROUND = "#0b0e12";

/**
 * Long enough for a photographer's name and a place, short enough that no
 * title can push the layout apart. The value is a query parameter, so this
 * is a bound on input rather than a guess about content.
 */
const MAX_TITLE = 70;

const WORDMARK = "the beauty of earth.";

function truncate(value: string, limit: number): string {
  return value.length <= limit
    ? value
    : `${value.slice(0, limit - 1).trimEnd()}…`;
}

/**
 * The card this site presents everywhere it is linked.
 *
 * It used to be a different design altogether — flat black, ninety-six point
 * extra-bold with a drop shadow, an emoji, and a bordered translucent panel
 * — which shared no colour, weight or spacing with the gallery it was
 * advertising. This is the same near-black ground, the same restrained
 * setting and the same small-caps metadata the site uses everywhere else.
 *
 * Note that a photograph's own link does not come through here at all:
 * `/photo/[id]` uses the photograph as its `og:image`, which is the right
 * preview for a picture. This card is for the places where the subject is
 * the gallery rather than any one image.
 */
export function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawTitle = searchParams.get("title") ?? WORDMARK;
    const title = truncate(rawTitle, MAX_TITLE);
    const subtitle = searchParams.get("subtitle");
    const isWordmark = title === WORDMARK;

    return new ImageResponse(
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "72px",
          backgroundColor: GROUND,
          // The same wash of colour the gallery lays over its ground, so the
          // card reads as lit from above rather than as a flat rectangle.
          backgroundImage:
            "radial-gradient(120% 70% at 50% 0%, rgba(42,107,124,0.38), rgba(11,14,18,0) 62%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/*
          The wordmark sits above the title unless it *is* the title, in
          which case printing it twice would be the only thing on the card.
        */}
        {isWordmark ? null : (
          <div
            style={{
              display: "flex",
              fontSize: "26px",
              fontWeight: 600,
              letterSpacing: "-0.5px",
              color: "rgba(255,255,255,0.45)",
              marginBottom: "20px",
            }}
          >
            {WORDMARK}
          </div>
        )}

        <div
          style={{
            display: "flex",
            fontSize: isWordmark ? "92px" : "72px",
            fontWeight: 600,
            // Matches the tight tracking the site sets its headings in.
            letterSpacing: isWordmark ? "-4.5px" : "-3px",
            lineHeight: 1.05,
            color: "#ffffff",
          }}
        >
          {title}
        </div>

        <div
          style={{
            display: "flex",
            marginTop: "24px",
            fontSize: "24px",
            letterSpacing: "3px",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.4)",
          }}
        >
          {subtitle ?? "Photographs from around the world"}
        </div>
      </div>,
      { width: WIDTH, height: HEIGHT },
    );
  } catch (error) {
    console.error("Error generating OG image:", error);
    return new Response("Failed to generate the image", { status: 500 });
  }
}
