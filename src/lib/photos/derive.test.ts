import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { deriveFromBuffer, EXIF_OPTIONS, exifParam } from "./derive";

/**
 * The fixture is synthesised rather than committed. A real stock JPEG cannot
 * prove the GPS guarantee — it has no GPS tags to begin with, so a test
 * against one passes even if the allowlist is removed. Writing GPS in
 * ourselves and asserting it never comes back out is the only version of this
 * test that can fail when the code regresses.
 */
async function makePhoto(): Promise<Buffer> {
  return await sharp({
    create: {
      width: 240,
      height: 160,
      channels: 3,
      background: { r: 42, g: 107, b: 124 },
    },
  })
    .withExif({
      IFD0: { Make: "SONY", Model: "ILCE-7M4" },
      IFD2: {
        LensModel: "FE 35mm F1.8",
        FocalLength: "35",
        FNumber: "1.8",
        ExposureTime: "0.004",
        // exiv2's name for tag 0x8827. Plain "ISO" is silently ignored.
        ISOSpeedRatings: "400",
        DateTimeOriginal: "2026:04:11 08:32:10",
      },
      IFD3: {
        GPSLatitude: "48/1 8/1 0/1",
        GPSLongitude: "11/1 34/1 0/1",
        GPSLatitudeRef: "N",
        GPSLongitudeRef: "E",
      },
    })
    .jpeg()
    .toBuffer();
}

let photo: Buffer;

beforeAll(async () => {
  photo = await makePhoto();
});

describe("deriveFromBuffer", () => {
  it("reports the intrinsic dimensions next/image needs", async () => {
    const derived = await deriveFromBuffer(photo);
    expect(derived.width).toBe(240);
    expect(derived.height).toBe(160);
  });

  it("produces a small inline blur placeholder", async () => {
    const derived = await deriveFromBuffer(photo);
    expect(derived.blur_data_url.startsWith("data:image/webp;base64,")).toBe(
      true,
    );
    // Next inlines this into the HTML for every image on the page.
    expect(derived.blur_data_url.length).toBeLessThan(2000);
  });

  it("derives the dominant colour as a hex string", async () => {
    const derived = await deriveFromBuffer(photo);
    expect(derived.bg_color).toMatch(/^#[0-9a-f]{6}$/);

    // JPEG is lossy and sharp buckets colours into a histogram, so the
    // dominant colour lands near the source rather than exactly on it.
    // Asserting equality here would be asserting the codec, not our code.
    const [r, g, b] = [1, 3, 5].map((i) =>
      Number.parseInt(derived.bg_color.slice(i, i + 2), 16),
    );
    expect(Math.abs((r ?? 0) - 42)).toBeLessThan(10);
    expect(Math.abs((g ?? 0) - 107)).toBeLessThan(10);
    expect(Math.abs((b ?? 0) - 124)).toBeLessThan(10);
  });

  it("reads the camera and exposure a photographer cares about", async () => {
    const derived = await deriveFromBuffer(photo);
    expect(derived.exif?.camera).toBe("SONY ILCE-7M4");
    expect(derived.exif?.lens).toBe("FE 35mm F1.8");
    expect(derived.exif?.focal_length).toBe("35 mm");
    expect(derived.exif?.aperture).toBe("f/1.8");
    expect(derived.exif?.shutter).toBe("1/250 s");
    expect(derived.exif?.iso).toBe(400);
  });

  it("keeps the capture time as the camera's wall clock", async () => {
    const derived = await deriveFromBuffer(photo);
    // EXIF carries no timezone. Converting to UTC would invent an offset from
    // whatever machine happens to run the import, so the wall-clock reading
    // is stored verbatim instead.
    expect(derived.exif?.taken_at).toBe("2026-04-11 08:32:10");
  });

  it("never asks the parser for a block that can carry coordinates", () => {
    // The output assertion below would still pass if this were removed — the
    // field allowlist alone would filter GPS out. This pins the outer layer
    // so the two defences cannot silently collapse into one.
    expect(EXIF_OPTIONS.gps).toBe(false);
    expect(EXIF_OPTIONS.xmp).toBe(false);
    expect(EXIF_OPTIONS.iptc).toBe(false);
    expect(EXIF_OPTIONS.ifd1).toBe(false);
    expect(EXIF_OPTIONS.makerNote).toBe(false);
  });

  it("drops GPS even when the original carries it", async () => {
    const derived = await deriveFromBuffer(photo);
    const serialised = JSON.stringify(derived.exif).toLowerCase();
    expect(serialised).not.toContain("gps");
    expect(serialised).not.toContain("latitude");
    expect(serialised).not.toContain("longitude");
  });

  it("returns null exif for a photo that carries none", async () => {
    const bare = await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .jpeg()
      .toBuffer();
    expect((await deriveFromBuffer(bare)).exif).toBeNull();
  });

  it("rejects a buffer that is not an image", async () => {
    await expect(
      deriveFromBuffer(Buffer.from("this is not an image")),
    ).rejects.toThrow();
  });
});

describe("exifParam", () => {
  it("binds SQL NULL rather than the JSON value null", () => {
    /*
     * `JSON.stringify(null)` is the string "null", and "null"::jsonb is a
     * populated cell. A photograph with no camera data then fails to match
     * `WHERE exif IS NULL`, which is exactly the bug this closes.
     */
    expect(exifParam(null)).toBeNull();
    expect(exifParam(null)).not.toBe("null");
  });

  it("still serialises a populated exif block", () => {
    expect(exifParam({ camera: "SONY ILCE-7M4", iso: 400 })).toBe(
      '{"camera":"SONY ILCE-7M4","iso":400}',
    );
  });
});
