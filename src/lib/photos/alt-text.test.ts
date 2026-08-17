import { describe, expect, it } from "vitest";
import type { GalleryImage } from "@/data/galleryData";
import { photoAltText } from "./alt-text";

function photo(
  title: string,
  description: string,
  location: string | null = null,
): GalleryImage {
  return {
    id: "test",
    src: { src: "/x.jpg", width: 1, height: 1, blurDataURL: "" },
    title,
    description,
    bgColor: "#000",
    publishedAt: "2026-04-11T08:32:10.000Z",
    location,
    exif: null,
    pin: null,
    author: { slug: "a", name: "A", siteUrl: null },
  };
}

describe("photoAltText", () => {
  it("leads with the description, since that is what describes the picture", () => {
    expect(photoAltText(photo("Bali, Indonesia", "Aerial view of waves"))).toBe(
      "Aerial view of waves — Bali, Indonesia",
    );
  });

  it("falls back to the title when there is no description", () => {
    expect(photoAltText(photo("Bali, Indonesia", ""))).toBe("Bali, Indonesia");
  });

  it("uses the description alone when there is no title", () => {
    expect(photoAltText(photo("", "Aerial view of waves"))).toBe(
      "Aerial view of waves",
    );
  });

  /*
   * The place lives in `location` now. Titles were place names when this
   * function was written, so the fallback is what the old behaviour became
   * rather than a nicety — the fourteen photographs published before the
   * migration are the reason it has to keep working both ways.
   */
  it("prefers the location over the title for the place", () => {
    expect(
      photoAltText(
        photo("Tide Lines", "Aerial view of waves", "Bali, Indonesia"),
      ),
    ).toBe("Aerial view of waves — Bali, Indonesia");
  });

  it("falls back to the title when there is no location", () => {
    expect(photoAltText(photo("Bali, Indonesia", "Aerial view of waves"))).toBe(
      "Aerial view of waves — Bali, Indonesia",
    );
  });

  it("uses the location alone when there is no description", () => {
    expect(photoAltText(photo("Tide Lines", "", "Bali, Indonesia"))).toBe(
      "Bali, Indonesia",
    );
  });

  it("never returns an empty string, which would read as a decorative image", () => {
    expect(photoAltText(photo("", ""))).toBe("Photograph");
  });

  it("treats whitespace-only fields as absent", () => {
    expect(photoAltText(photo("  ", "  "))).toBe("Photograph");
    expect(photoAltText(photo("Bali", "   "))).toBe("Bali");
  });
});
