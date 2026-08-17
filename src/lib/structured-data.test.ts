import { describe, expect, it } from "vitest";
import type { GalleryImage } from "@/data/galleryData";
import {
  GALLERY_SCHEMA_LIMIT,
  gallerySchema,
  photographerSchema,
  photographSchema,
} from "./structured-data";

const ORIGIN = "https://example.test";

function photo(overrides: Partial<GalleryImage> = {}): GalleryImage {
  return {
    id: "abc123",
    src: {
      src: "https://blob.example/photo.jpg",
      width: 4000,
      height: 3000,
      blurDataURL: "",
    },
    title: "Low Sun",
    description: "Low winter sun over the fjord.",
    bgColor: "#123456",
    location: "Reine, Lofoten, Norway",
    publishedAt: "2026-04-11T08:32:10.000Z",
    exif: null,
    author: {
      slug: "mara-lindqvist",
      name: "Mara Lindqvist",
      siteUrl: "https://mara.example",
    },
    ...overrides,
  };
}

describe("photographSchema", () => {
  it("describes the photograph, its page and its file", () => {
    const schema = photographSchema(photo(), ORIGIN);
    expect(schema["@type"]).toBe("ImageObject");
    expect(schema["url"]).toBe(`${ORIGIN}/photo/abc123`);
    expect(schema["contentUrl"]).toBe("https://blob.example/photo.jpg");
    expect(schema["width"]).toBe(4000);
  });

  it("credits the photographer, and links their own site with sameAs", () => {
    const schema = photographSchema(photo(), ORIGIN);
    const creator = schema["creator"] as Record<string, unknown>;
    expect(creator["name"]).toBe("Mara Lindqvist");
    expect(creator["url"]).toBe(`${ORIGIN}/by/mara-lindqvist`);
    expect(creator["sameAs"]).toEqual(["https://mara.example"]);
    expect(schema["creditText"]).toBe("Mara Lindqvist");
    expect(schema["copyrightNotice"]).toBe("© Mara Lindqvist");
  });

  it("omits sameAs rather than emitting null when there is no site", () => {
    const schema = photographSchema(
      photo({ author: { slug: "a", name: "A", siteUrl: null } }),
      ORIGIN,
    );
    expect(schema["creator"]).not.toHaveProperty("sameAs");
  });

  it("omits contentLocation rather than emitting null", () => {
    const schema = photographSchema(photo({ location: null }), ORIGIN);
    expect(schema).not.toHaveProperty("contentLocation");
  });

  it("uses the same description a screen reader gets", () => {
    const schema = photographSchema(photo(), ORIGIN);
    /*
     * The place comes from `location`, not the title. Photographs used to be
     * titled with their location and this fixture was written that way; the
     * fourteen published ones were renamed once `location` existed to hold
     * the place, and `photoAltText` followed.
     */
    expect(schema["description"]).toBe(
      "Low winter sun over the fjord. — Reine, Lofoten, Norway",
    );
  });
});

describe("photographerSchema", () => {
  it("is a profile whose subject is the person", () => {
    const schema = photographerSchema(photo().author, [photo()], ORIGIN);
    expect(schema["@type"]).toBe("ProfilePage");
    const person = schema["mainEntity"] as Record<string, unknown>;
    expect(person["@type"]).toBe("Person");
    expect((person["image"] as unknown[]).length).toBe(1);
  });
});

describe("gallerySchema", () => {
  it("caps the photographs it describes", () => {
    const many = Array.from({ length: GALLERY_SCHEMA_LIMIT + 10 }, (_, i) =>
      photo({ id: `photo-${i}` }),
    );
    const schema = gallerySchema(many, ORIGIN, "the beauty of earth.");
    expect((schema["image"] as unknown[]).length).toBe(GALLERY_SCHEMA_LIMIT);
  });

  it("survives an empty gallery", () => {
    const schema = gallerySchema([], ORIGIN, "the beauty of earth.");
    expect(schema["image"]).toEqual([]);
  });
});

describe("serialisation safety", () => {
  it("cannot break out of a script tag through a title", () => {
    const nasty = photo({ title: "</script><img src=x onerror=alert(1)>" });
    const payload = JSON.stringify(photographSchema(nasty, ORIGIN)).replace(
      /</g,
      "\\u003c",
    );
    expect(payload).not.toContain("</script");
    expect(payload).not.toContain("<img");
    // And it is still valid JSON describing the same photograph.
    expect(JSON.parse(payload.replace(/\\u003c/g, "<")).name).toContain("img");
  });
});
