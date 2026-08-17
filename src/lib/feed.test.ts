import { describe, expect, it } from "vitest";
import type { GalleryImage } from "@/data/galleryData";
import { buildRssFeed, escapeXml, FEED_LIMIT } from "./feed";

const META = {
  title: "the beauty of earth.",
  description: "Photographs from around the world.",
  origin: "https://example.test",
  selfPath: "/feed.xml",
};

function photo(overrides: Partial<GalleryImage> = {}): GalleryImage {
  return {
    id: "abc123",
    src: {
      src: "https://blob.example/photo.jpg",
      width: 4000,
      height: 3000,
      blurDataURL: "",
    },
    title: "Lofoten, Norway",
    description: "Low winter sun over the fjord.",
    bgColor: "#123456",
    location: "Reine",
    publishedAt: "2026-04-11T08:32:10.000Z",
    exif: null,
    pin: null,
    author: {
      slug: "mara-lindqvist",
      name: "Mara Lindqvist",
      siteUrl: null,
    },
    ...overrides,
  };
}

describe("escapeXml", () => {
  it("escapes the five characters that break XML", () => {
    expect(escapeXml(`& < > " '`)).toBe("&amp; &lt; &gt; &quot; &apos;");
  });

  it("does not double-escape an ampersand it introduced itself", () => {
    // The bug a chain of `.replace` calls produces: `<` becomes `&lt;`, then
    // the ampersand pass turns it into `&amp;lt;`.
    expect(escapeXml("a < b & c")).toBe("a &lt; b &amp; c");
  });

  it("leaves ordinary text alone", () => {
    expect(escapeXml("Böblingen, Germany — 2026")).toBe(
      "Böblingen, Germany — 2026",
    );
  });
});

/* Long XML literals that Biome's secret heuristic mistakes for keys. */
// biome-ignore-start lint/security/noSecrets: RSS elements, not credentials
const GUID_ELEMENT =
  '<guid isPermaLink="true">https://example.test/photo/abc123</guid>';
const LAST_BUILD_ELEMENT =
  "<lastBuildDate>Sat, 11 Apr 2026 08:32:10 GMT</lastBuildDate>";
// biome-ignore-end lint/security/noSecrets: RSS elements, not credentials

describe("buildRssFeed", () => {
  it("is well-formed and self-describing", () => {
    const xml = buildRssFeed([photo()], META);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain(
      '<atom:link href="https://example.test/feed.xml" rel="self"',
    );
  });

  it("links each item to its own page and encloses the photograph", () => {
    const xml = buildRssFeed([photo()], META);
    expect(xml).toContain("<link>https://example.test/photo/abc123</link>");
    expect(xml).toContain(GUID_ELEMENT);
    expect(xml).toContain('<enclosure url="https://blob.example/photo.jpg"');
  });

  it("credits the photographer and dates the item", () => {
    const xml = buildRssFeed([photo()], META);
    expect(xml).toContain("<dc:creator>Mara Lindqvist</dc:creator>");
    expect(xml).toContain("<pubDate>Sat, 11 Apr 2026 08:32:10 GMT</pubDate>");
  });

  it("dates the channel from the newest item, not from the build", () => {
    const xml = buildRssFeed(
      [
        photo({ publishedAt: "2026-04-11T08:32:10.000Z" }),
        photo({ id: "older", publishedAt: "2020-01-01T00:00:00.000Z" }),
      ],
      META,
    );
    expect(xml).toContain(LAST_BUILD_ELEMENT);
  });

  it("orders by date, not by the gallery's pinned opener", () => {
    // The feed query returns `is_opener DESC, published_at DESC`, so the
    // opening photograph arrives first however old it is. A subscriber wants
    // what is new.
    const xml = buildRssFeed(
      [
        photo({ id: "pinned-opener", publishedAt: "2020-01-01T00:00:00.000Z" }),
        photo({ id: "newest", publishedAt: "2026-04-11T08:32:10.000Z" }),
        photo({ id: "middle", publishedAt: "2023-06-15T00:00:00.000Z" }),
      ],
      META,
    );
    // `<link>` only — each item also repeats the URL in its `<guid>`.
    const order = [
      ...xml.matchAll(/<link>[^<]*\/photo\/([a-z0-9-]+)<\/link>/g),
    ].map((m) => m[1]);
    expect(order).toEqual(["newest", "middle", "pinned-opener"]);
  });

  it("keeps the newest item when the cap truncates", () => {
    const old = Array.from({ length: FEED_LIMIT }, (_, i) =>
      photo({ id: `old-${i}`, publishedAt: "2020-01-01T00:00:00.000Z" }),
    );
    const xml = buildRssFeed(
      [
        ...old,
        photo({ id: "newest", publishedAt: "2026-04-11T08:32:10.000Z" }),
      ],
      META,
    );
    expect(xml).toContain("<link>https://example.test/photo/newest</link>");
  });

  it("caps the number of items", () => {
    const many = Array.from({ length: FEED_LIMIT + 20 }, (_, i) =>
      photo({ id: `photo-${i}` }),
    );
    const xml = buildRssFeed(many, META);
    expect(xml.split("<item>").length - 1).toBe(FEED_LIMIT);
  });

  it("survives an empty gallery without inventing a build date", () => {
    const xml = buildRssFeed([], META);
    expect(xml).toContain("<channel>");
    expect(xml).not.toContain("<item>");
    expect(xml).not.toContain("lastBuildDate");
  });

  it("cannot be broken by a title a contributor typed", () => {
    const xml = buildRssFeed(
      [photo({ title: 'Bali </title><script>alert(1)</script> & "friends"' })],
      META,
    );
    expect(xml).not.toContain("<script>");
    expect(xml).not.toContain("</title><");
    expect(xml).toContain("&lt;script&gt;");
  });

  it("names the photographer when a photograph has no title", () => {
    const xml = buildRssFeed([photo({ title: "" })], META);
    expect(xml).toContain("<title>A photograph by Mara Lindqvist</title>");
  });
});
