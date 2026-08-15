import { describe, expect, it } from "vitest";
import type { GalleryImage } from "@/data/galleryData";
import { ANNOUNCEMENT_LIMIT, buildAnnouncement } from "./announcement";

const ORIGIN = "https://example.test";
const UNSUB = "https://example.test/subscribe/unsubscribe?token=abc";

function photo(overrides: Partial<GalleryImage> = {}): GalleryImage {
  return {
    id: "abc123",
    src: { src: "https://blob/x.jpg", width: 10, height: 10, blurDataURL: "" },
    title: "Lofoten, Norway",
    description: "Low winter sun over the fjord.",
    bgColor: "#123456",
    location: "Reine",
    publishedAt: "2026-04-11T08:32:10.000Z",
    exif: null,
    author: { slug: "mara", name: "Mara Lindqvist", siteUrl: null },
    ...overrides,
  };
}

describe("buildAnnouncement", () => {
  it("names the photograph and photographer when there is only one", () => {
    const { subject } = buildAnnouncement([photo()], ORIGIN, UNSUB);
    expect(subject).toBe(
      "Lofoten, Norway — a new photograph by Mara Lindqvist",
    );
  });

  it("counts them when there are several", () => {
    const { subject } = buildAnnouncement(
      [photo(), photo({ id: "b" }), photo({ id: "c" })],
      ORIGIN,
      UNSUB,
    );
    expect(subject).toBe("3 new photographs on the beauty of earth.");
  });

  it("falls back to the photographer when a photograph has no title", () => {
    const { subject } = buildAnnouncement(
      [photo({ title: "" })],
      ORIGIN,
      UNSUB,
    );
    expect(subject).toBe("A new photograph by Mara Lindqvist");
  });

  it("links each photograph to its own page", () => {
    const { html, text } = buildAnnouncement([photo()], ORIGIN, UNSUB);
    expect(html).toContain("https://example.test/photo/abc123");
    expect(text).toContain("https://example.test/photo/abc123");
  });

  it("carries the unsubscribe link in both parts", () => {
    const { html, text } = buildAnnouncement([photo()], ORIGIN, UNSUB);
    expect(html).toContain(UNSUB);
    expect(text).toContain(UNSUB);
  });

  it("caps the list and says how many are left", () => {
    const many = Array.from({ length: ANNOUNCEMENT_LIMIT + 5 }, (_, i) =>
      photo({ id: `photo-${i}` }),
    );
    const { html, text } = buildAnnouncement(many, ORIGIN, UNSUB);
    expect(html.split("<li ").length - 1).toBe(ANNOUNCEMENT_LIMIT);
    expect(text).toContain("And 5 more");
  });

  it("says nothing about a remainder when there is none", () => {
    const { text } = buildAnnouncement([photo()], ORIGIN, UNSUB);
    expect(text).not.toContain("more, in the gallery");
  });

  it("cannot be broken out of by a title a contributor typed", () => {
    const { html } = buildAnnouncement(
      [photo({ title: "</a><script>alert(1)</script>" })],
      ORIGIN,
      UNSUB,
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("</a><");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes a photographer's name too", () => {
    const { html } = buildAnnouncement(
      [photo({ author: { slug: "x", name: "A & B <b>", siteUrl: null } })],
      ORIGIN,
      UNSUB,
    );
    expect(html).toContain("A &amp; B &lt;b&gt;");
  });
});
