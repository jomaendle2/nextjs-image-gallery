import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BLOB_HOST } from "./blob-host";
import {
  alternates,
  contributorAlternates,
  ogCard,
  shareCard,
} from "./metadata";
import { allSourceFiles, SRC } from "./source-text";

/** A URL `isOurBlob` accepts: our host, and under the photograph prefix. */
function blob(name: string): string {
  return `https://${BLOB_HOST}/photos/${name}`;
}

/**
 * The share card's URL, which nobody ever looks at.
 *
 * That is the whole argument for testing it. A link preview is rendered by
 * somebody else's server, in somebody else's app, days after the link was
 * sent — so a card that breaks does so silently and stays broken, and the
 * person least likely to notice is the one who shared it. These are cheap
 * assertions about a string, standing in for a feedback loop that does not
 * exist.
 */

describe("ogCard", () => {
  it("escapes a title that would otherwise truncate the card", () => {
    /*
     * The failure this prevents. An unescaped `&` ends the parameter, so
     * "Jo & Anna" arrives at the route as "Jo " and the card silently prints
     * a name that is not anybody's.
     */
    const url = ogCard({ title: "Jo & Anna" });
    expect(url).not.toMatch(/title=Jo & Anna/);
    expect(new URL(url, "https://x.test").searchParams.get("title")).toBe(
      "Jo & Anna",
    );
  });

  it("survives the characters a display name really contains", () => {
    for (const name of ["Jo Mändle", "N'Dour", "文子", "A/B", "50% Grey"]) {
      const parsed = new URL(ogCard({ title: name }), "https://x.test");
      expect(parsed.searchParams.get("title")).toBe(name);
    }
  });

  it("omits the subtitle rather than sending an empty one", () => {
    // The route lays out a card with no subtitle differently from one with a
    // blank line where a subtitle should be.
    expect(ogCard({ title: "x" })).not.toContain("subtitle");
    expect(ogCard({ title: "x", subtitle: "" })).not.toContain("subtitle");
    expect(ogCard({ title: "x", subtitle: "y" })).toContain("subtitle=y");
  });

  it("joins previews with commas, the shape the route parses", () => {
    const url = ogCard({
      title: "x",
      previews: [blob("1.jpg"), blob("2.jpg")],
    });
    expect(new URL(url, "https://x.test").searchParams.get("previews")).toBe(
      `${blob("1.jpg")},${blob("2.jpg")}`,
    );
  });

  it("drops anything the card could not fetch", () => {
    /*
     * A relative path or a data URL costs a round trip to be refused, and a
     * strip that silently renders empty is worse than no strip: the card
     * still claims the space for photographs and shows none.
     *
     * The look-alike host is the case that made this test earn its name. The
     * filter was `startsWith("https://")` under a comment claiming the route
     * "refuses anything that is not one of our blobs" — so a URL on somebody
     * else's host passed here and was refused at the other end by
     * `isOurBlob`, producing precisely the empty strip the comment promised
     * to prevent. Both ends now ask the same question.
     */
    const url = ogCard({
      title: "x",
      previews: [
        "/local.jpg",
        "data:image/png;base64,AAA",
        `https://${BLOB_HOST}.evil.example/photos/1.jpg`,
        `https://${BLOB_HOST}/avatars/1.jpg`,
        blob("1.jpg"),
      ],
    });
    expect(new URL(url, "https://x.test").searchParams.get("previews")).toBe(
      blob("1.jpg"),
    );
  });

  it("omits the parameter entirely when nothing usable is left", () => {
    expect(ogCard({ title: "x", previews: [] })).not.toContain("previews");
    expect(ogCard({ title: "x", previews: ["/nope.jpg"] })).not.toContain(
      "previews",
    );
    expect(
      ogCard({ title: "x", previews: ["https://elsewhere.test/1.jpg"] }),
    ).not.toContain("previews");
  });

  it("stays relative, so the origin comes from metadataBase", () => {
    // Reading the origin here would put configuration in a formatting helper
    // — and an absolute URL built from the wrong origin is how a preview ends
    // up fetching a card from a domain nobody advertises.
    expect(ogCard({ title: "x" }).startsWith("/api/og?")).toBe(true);
  });
});

describe("alternates", () => {
  it("keeps the feed attached to every canonical", () => {
    /*
     * `alternates` is replaced rather than merged by Next, so a page that
     * sets a canonical by hand drops the RSS autodiscovery link with it —
     * which happened to `/photo/[id]`, the page people actually land on.
     */
    const value = alternates("/globe");
    expect(value?.canonical).toBe("/globe");
    expect(value?.types?.["application/rss+xml"]).toBeDefined();
  });

  it("offers a photographer's own feed first, then the site's", () => {
    const feeds = contributorAlternates("/by/anna", "anna", "Anna")?.types?.[
      "application/rss+xml"
    ] as { url: string }[];
    expect(feeds[0]?.url).toBe("/by/anna/feed.xml");
    expect(feeds[1]?.url).toBe("/feed.xml");
  });
});

describe("shareCard", () => {
  const card = shareCard({
    title: "Photographers",
    description: "The photographers contributing to the beauty of earth.",
    url: "/photographers",
    card: "/api/og?title=Photographers",
    alt: "A strip of their work",
  });

  it("always puts alt text on the image", () => {
    /*
     * The finding this helper exists for. Five hand-written blocks and
     * exactly one of them carried `alt` — the root layout, which spends eight
     * comment lines on why it matters — so the two newest share cards on the
     * site shipped without it. `alt` is a required parameter here, so the
     * only way to omit it now is to stop calling this, which the sweep below
     * forbids.
     */
    const images = card.openGraph?.images as { alt?: string }[];
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      expect(image.alt).toBeTruthy();
    }
  });

  it("emits the union of what the five blocks used to set", () => {
    // Not the intersection: three of the five were thinner than the others,
    // and levelling down would have been a consolidation that lost something.
    const og = card.openGraph as {
      type?: string;
      url?: string;
      images: { url: string; width: number; height: number }[];
    };
    expect(og.type).toBe("website");
    expect(og.url).toBe("/photographers");
    expect(og.images[0]?.width).toBe(1200);
    expect(og.images[0]?.height).toBe(630);
    // `Metadata["twitter"]` is a union whose narrower arms have no `card`,
    // which is exactly the field being asserted on.
    const twitter = card.twitter as { title?: string; card?: string };
    expect(twitter.title).toBe("Photographers");
    expect(twitter.card).toBe("summary_large_image");
  });
});

/**
 * The sweep, so a sixth hand-written block cannot appear.
 *
 * The docblock on `ogCard` predicted that a fourth hand-written card would
 * differ from the other three; it was right, and the two that were added
 * differed twice over — they set `og.url` where their siblings did not, and
 * neither carried alt text. A prediction in a comment is not a control, and
 * this is the shape the repository already uses to turn one into the other.
 *
 * `/photo/[id]` is not caught, and should not be: it builds its card out of
 * the photograph itself rather than from `/api/og`, so it never calls
 * `ogCard` and is excluded by the detector rather than by an exception.
 */
describe("every page that builds a card builds the block around it too", () => {
  const callers = allSourceFiles()
    .map((file) => ({ file, source: readFileSync(file, "utf8") }))
    .filter(({ source }) => source.includes("ogCard({"));

  it("finds the call sites at all", () => {
    // If this finds nothing, the detector has broken, not the code.
    expect(callers.length).toBeGreaterThan(0);
  });

  it("none of them hand-writes an openGraph block", () => {
    const handwritten = callers
      .filter(({ source }) => source.includes("openGraph:"))
      .map(({ file }) => file.replace(SRC, ""));
    expect(handwritten).toEqual([]);
  });

  it("all of them go through shareCard", () => {
    const missing = callers
      .filter(({ source }) => !source.includes("shareCard({"))
      .map(({ file }) => file.replace(SRC, ""));
    expect(missing).toEqual([]);
  });
});
