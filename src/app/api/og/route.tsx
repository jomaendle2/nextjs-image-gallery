import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { isOurBlob } from "@/lib/blob-host";

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
/** The subtitle is one line under the title; more than this never shows. */
const MAX_SUBTITLE = 90;

const WORDMARK = "the beauty of earth.";

/**
 * How many photographs a photographer's card carries.
 *
 * A card for a photographer that shows no photography is the worst share
 * preview a gallery can have — `/by/[slug]` is the link they send about
 * their own work, and it previewed as a name on a gradient. One large
 * photograph would crop badly across the mix of portrait and landscape
 * here; three lets the shapes disagree without any of them being wrong.
 */
const PREVIEW_COUNT = 3;
const PREVIEW_HEIGHT = 380;

/**
 * The type scale, which steps down when photographs take the top two-thirds.
 *
 * 630 less the strip and the padding leaves about 160px for three stacked
 * lines, and the standalone card's 72px title does not fit in that on its
 * own.
 */
function typeScale(hasPreviews: boolean, isWordmark: boolean) {
  if (isWordmark) {
    return { title: "92px", tracking: "-4.5px", gap: "20px", metaGap: "24px" };
  }
  return hasPreviews
    ? { title: "54px", tracking: "-2px", gap: "10px", metaGap: "12px" }
    : { title: "72px", tracking: "-2px", gap: "20px", metaGap: "24px" };
}

/**
 * The strip of work across the top of a photographer's card.
 *
 * Satori has no `object-fit` shorthand on a container, so each photograph is
 * its own flex child sized to cover — equal columns, shapes allowed to
 * differ, which suits a mix of portrait and landscape better than one large
 * image cropped to a banner.
 */
function PhotographStrip({ urls }: { urls: string[] }) {
  return (
    <div style={{ display: "flex", width: "100%", height: PREVIEW_HEIGHT }}>
      {/*
        biome-ignore-start lint/performance/noImgElement: this tree is
        rendered by Satori into a PNG on the server. `next/image` is a
        browser component and has no runtime here.
      */}
      {urls.map((url) => (
        <img
          alt=""
          height={PREVIEW_HEIGHT}
          key={url}
          src={url}
          style={{ objectFit: "cover", flex: "1 1 0", height: PREVIEW_HEIGHT }}
          width={WIDTH / urls.length}
        />
      ))}
      {/* biome-ignore-end lint/performance/noImgElement: as above. */}
    </div>
  );
}

/**
 * Absolute image URLs, bounded so a crafted query cannot stall the render —
 * and pinned to our own Blob store, which is the half that was missing.
 *
 * Satori fetches every one of these server-side while it renders the card, so
 * whatever passes this filter is a URL our machine will request and composite
 * into a PNG it then hands back to whoever asked. Accepting anything starting
 * `https://` made this an unauthenticated image proxy: a stranger could
 * request `/api/og?previews=https://somewhere-else/x.png` and get those bytes
 * back rendered from our IP, on our egress, cached at the CDN for a day.
 *
 * `isOurBlob` is the same pin `next.config.ts` puts on the image optimizer,
 * and for the same reason — see `src/lib/blob-host.ts`.
 */
function previewUrls(raw: string | null): string[] {
  if (raw === null || raw === "") {
    return [];
  }
  return raw
    .split(",")
    .map((url) => url.trim())
    .filter((url) => isOurBlob(url))
    .slice(0, PREVIEW_COUNT);
}

function truncate(value: string, limit: number): string {
  return value.length <= limit
    ? value
    : `${value.slice(0, limit - 1).trimEnd()}…`;
}

/**
 * The card this site presents everywhere it is linked.
 *
 * The same near-black ground, restrained setting and small-caps metadata the
 * site uses everywhere else, so the card and the page it advertises look
 * like the same product.
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
    /*
     * Bounded like the title. This endpoint is public, uncredentialed and
     * cacheable, so an unbounded string here is an invitation to make the
     * layout engine chew through a hundred kilobytes per request.
     */
    const previews = previewUrls(searchParams.get("previews"));
    const rawSubtitle = searchParams.get("subtitle");
    const subtitle =
      rawSubtitle === null ? null : truncate(rawSubtitle, MAX_SUBTITLE);
    const isWordmark = title === WORDMARK;
    const scale = typeScale(previews.length > 0, isWordmark);
    const isHandle = (subtitle ?? "").startsWith("@");

    return new ImageResponse(
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: previews.length > 0 ? "0" : "72px",
          backgroundColor: GROUND,
          // The same wash of colour the gallery lays over its ground, so the
          // card reads as lit from above rather than as a flat rectangle.
          backgroundImage:
            "radial-gradient(120% 70% at 50% 0%, rgba(42,107,124,0.38), rgba(11,14,18,0) 62%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {previews.length === 0 ? null : <PhotographStrip urls={previews} />}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: previews.length > 0 ? "36px 72px 52px" : "0",
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
                marginBottom: scale.gap,
              }}
            >
              {WORDMARK}
            </div>
          )}

          <div
            style={{
              display: "flex",
              fontSize: scale.title,
              fontWeight: 600,
              // Matches the tight tracking the site sets its headings in.
              letterSpacing: scale.tracking,
              lineHeight: 1.05,
              color: "#ffffff",
            }}
          >
            {title}
          </div>

          <div
            style={{
              display: "flex",
              marginTop: scale.metaGap,
              fontSize: previews.length > 0 ? "20px" : "24px",
              letterSpacing: isHandle ? "0.5px" : "3px",
              /*
               * Handles are lowercase everywhere they appear — @jo-maendle,
               * never @JO-MAENDLE. The small-caps treatment is right for a
               * label like "photographs from around the world" and wrong for
               * something a person types.
               */
              textTransform: isHandle ? "none" : "uppercase",
              color: "rgba(255,255,255,0.4)",
            }}
          >
            {subtitle ?? "Photographs from around the world"}
          </div>
        </div>
      </div>,
      {
        width: WIDTH,
        height: HEIGHT,
        /*
         * A share card is the same picture for everyone who asks, and it is
         * asked for by crawlers rather than people. Without this every
         * social preview re-rendered it and re-fetched its photographs.
         *
         * `s-maxage` and `stale-while-revalidate` are the two that matter,
         * and both were missing. `max-age` alone is a private-browser
         * instruction: the shared cache in front of this route fell back to
         * its default, so the day the entry expired the next crawler to ask
         * paid for a full Satori render plus three blob fetches while it
         * waited. With these, the CDN holds the card for a day and then
         * keeps serving the stale one for a week while it fetches a fresh
         * copy behind the reader's back — nobody ever waits for the render.
         *
         * `immutable` is gone, and deliberately. It promised the bytes at
         * this URL would never change, which is false: the card is built
         * from a photographer's display name and their three most recent
         * photographs, and the query string does not change when those do.
         * A week of stale-while-revalidate is the honest version of the same
         * bargain.
         */
        headers: {
          "Cache-Control":
            "public, s-maxage=86400, stale-while-revalidate=604800, max-age=86400",
        },
      },
    );
  } catch (error) {
    console.error("Error generating OG image:", error);
    return new Response("Failed to generate the image", { status: 500 });
  }
}
