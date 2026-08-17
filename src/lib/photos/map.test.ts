import { describe, expect, it } from "vitest";
import { toGalleryImage } from "./map";
import type { PhotoRow } from "./types";

const row: PhotoRow = {
  id: "abc123",
  blob_url: "https://xyz.public.blob.vercel-storage.com/photos/abc123.jpg",
  width: 4000,
  height: 2667,
  blur_data_url: "data:image/webp;base64,AAAA",
  bg_color: "#2a6b7c",
  title: "Bali, Indonesia",
  description: "Aerial view of tale waves",
  location: "Nusa Penida",
  // What `coarsen(-8.7277, 115.5444)` returns: the cell, not the island.
  coarse_lat: -8.7028,
  coarse_lng: 115.1637,
  published_at: "2026-04-11T08:32:10.000Z",
  has_member_details: true,
  exif: { camera: "SONY ILCE-7M4", iso: 100 },
  author_slug: "anna-weber",
  author_name: "Anna Weber",
  author_site_url: "https://anna.example",
};

describe("toGalleryImage", () => {
  it("shapes src exactly like a static import", () => {
    // next/image accepts any object of this shape, whatever produced it.
    // This is the whole reason the carousel needs no changes.
    expect(toGalleryImage(row).src).toEqual({
      src: row.blob_url,
      width: 4000,
      height: 2667,
      blurDataURL: "data:image/webp;base64,AAAA",
    });
  });

  it("carries the credit through so the viewer can attribute the photo", () => {
    expect(toGalleryImage(row).author).toEqual({
      slug: "anna-weber",
      name: "Anna Weber",
      siteUrl: "https://anna.example",
    });
  });

  it("keeps id a string so it matches the image_views key", () => {
    expect(toGalleryImage(row).id).toBe("abc123");
  });

  it("renames only at this boundary, leaving snake_case in the row", () => {
    const image = toGalleryImage(row);
    expect(image.bgColor).toBe("#2a6b7c");
    expect(Object.keys(image)).not.toContain("bg_color");
  });

  /*
   * The pin is folded into one object here rather than left as two nullable
   * numbers, so no component can render half a coordinate. The exact pair is
   * not on `PhotoRow` at all, which is the gate — there is nothing for this
   * function to leak even if somebody rewrote it carelessly.
   */
  it("folds the coarse pair into a single pin", () => {
    expect(toGalleryImage(row).pin).toEqual({ lat: -8.7028, lng: 115.1637 });
  });

  it("has no pin at all when the photographer marked nothing", () => {
    const unmarked = toGalleryImage({
      ...row,
      coarse_lat: null,
      coarse_lng: null,
    });
    expect(unmarked.pin).toBeNull();
  });

  it("refuses half a pin rather than passing a bare number through", () => {
    expect(toGalleryImage({ ...row, coarse_lng: null }).pin).toBeNull();
    expect(toGalleryImage({ ...row, coarse_lat: null }).pin).toBeNull();
  });

  /*
   * The one thing about the paid fields a public payload carries, and it has
   * to survive this boundary intact: `false` here is what silences the
   * membership offer under a photograph with an empty shelf, and dropping the
   * field would make every photograph look empty rather than making the
   * mapper look broken.
   */
  it("carries the member-details bit through, both ways", () => {
    expect(toGalleryImage(row).hasMemberDetails).toBe(true);
    expect(
      toGalleryImage({ ...row, has_member_details: false }).hasMemberDetails,
    ).toBe(false);
  });

  it("passes a missing site link through as null rather than dropping it", () => {
    const anonymous = toGalleryImage({ ...row, author_site_url: null });
    expect(anonymous.author.siteUrl).toBeNull();
  });
});
