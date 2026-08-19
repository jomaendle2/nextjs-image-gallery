import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import {
  DISPLAY_MAX_EDGE,
  DISPLAY_QUALITY,
  deriveFromBuffer,
  EXIF_OPTIONS,
} from "./derive";

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

/**
 * The resize itself, which nothing tested.
 *
 * The fixture above is 240 × 160, and `makeDisplayBuffer` resizes with
 * `withoutEnlargement: true` — so every existing assertion runs down a path
 * where the resize is a no-op. `DISPLAY_MAX_EDGE` was the number the whole
 * delivery story rests on and no test could have noticed it changing, which
 * became worth fixing the moment the upload cap doubled.
 *
 * A separate fixture because it is expensive: mozjpeg over a 5000 px canvas
 * is not something to do once per assertion in the shared `beforeAll`.
 */
/**
 * Raw RGB that does not compress away.
 *
 * A flat fill at 5000 px encodes to a few kilobytes, which would make "the
 * copy is smaller than the original" true for a reason that has nothing to do
 * with the resize. Deterministic rather than random, so a failure is
 * reproducible; `sharp`'s own `create.noise` would be simpler but is absent
 * from its TypeScript `Create` type, and a fixture that has to be cast is a
 * fixture that stops being checked.
 *
 * A plain linear congruential generator, arithmetic rather than bitwise. The
 * numbers only have to be incompressible, not statistically sound, and biome
 * forbids bitwise operators here for the good reason that everywhere else in
 * this codebase they would be a mistake.
 */
function noisy(width: number, height: number): Buffer {
  const pixels = Buffer.allocUnsafe(width * height * 3);
  let state = 12_345;
  for (let i = 0; i < pixels.length; i += 1) {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    pixels[i] = Math.floor(state / 65_536) % 256;
  }
  return pixels;
}

/**
 * The one block in this suite that encodes real megapixels, and the only one
 * that needs longer than vitest's five-second default.
 *
 * Everything above works on a 240 x 160 fixture and finishes in milliseconds.
 * These do not: the resize is the subject, so the fixtures have to be larger
 * than `DISPLAY_MAX_EDGE` to exercise it at all, and mozjpeg over a canvas
 * that size costs seconds rather than milliseconds. The orientation test is
 * the worst of them, because the tag it checks has to be written by the
 * encoder onto a canvas of its own — nine megapixels of incompressible noise,
 * generated and encoded inside the test body. Measured at a fraction of a
 * second on a developer's machine and six seconds in a modest container,
 * against a five-second ceiling: which is to say it was passing on how fast
 * the machine happened to be, and this branch is the one that put it on a
 * runner nobody chose.
 *
 * Raised rather than made cheaper, because the size is load-bearing — a
 * fixture small enough to be fast is a fixture that never reaches the clamp
 * these tests exist to check.
 *
 * Generous on purpose. This bounds a hang, not a performance regression;
 * there is nothing here worth failing a build over at eight seconds that is
 * fine at four.
 */
describe("the display copy", { timeout: 30_000 }, () => {
  let wide: Buffer;
  let derivedWide: Awaited<ReturnType<typeof deriveFromBuffer>>;

  beforeAll(async () => {
    /*
     * Wider than the cap on one axis and shorter on the other, so a resize
     * that clamped the wrong edge — or clamped both to a square — fails
     * rather than passing by symmetry. Noise rather than a flat fill: a
     * single-colour 5000 px JPEG compresses to almost nothing, which would
     * make "smaller than the original" true for uninteresting reasons.
     */
    wide = await sharp(noisy(5000, 2500), {
      raw: { width: 5000, height: 2500, channels: 3 },
    })
      .jpeg({ quality: 100 })
      .toBuffer();
    derivedWide = await deriveFromBuffer(wide);
  });

  it("clamps the longest edge to DISPLAY_MAX_EDGE", async () => {
    expect(derivedWide.width).toBe(DISPLAY_MAX_EDGE);
    // 5000 × 2500 is 2:1, so the short edge lands at half the cap.
    expect(derivedWide.height).toBe(DISPLAY_MAX_EDGE / 2);

    const meta = await sharp(derivedWide.display).metadata();
    expect(Math.max(meta.width, meta.height)).toBe(DISPLAY_MAX_EDGE);
  });

  it("reports the dimensions of the copy, not of the original", () => {
    // These feed `next/image`'s intrinsic size. Reporting the source's would
    // be a wrong aspect ratio on every rotated photograph, and layout shift.
    expect(derivedWide.width).not.toBe(5000);
  });

  it("is smaller than what was uploaded", () => {
    expect(derivedWide.display.byteLength).toBeLessThan(wide.byteLength);
  });

  it("re-encodes as JPEG whatever came in", async () => {
    const meta = await sharp(derivedWide.display).metadata();
    expect(meta.format).toBe("jpeg");
    // The quality is a lever the plan explicitly names; pin it so a change
    // to it is a decision rather than a side effect.
    expect(DISPLAY_QUALITY).toBe(85);
  });

  it("bakes orientation in rather than carrying the tag", async () => {
    /*
     * `.rotate()` applies the EXIF orientation and drops it, which is what
     * makes the reported width and height trustworthy. A copy that still
     * carried the tag would be rendered rotated by a browser *and* measured
     * unrotated here — the layout-shift bug the docblock describes.
     */
    const sideways = await sharp(noisy(4200, 2100), {
      raw: { width: 4200, height: 2100, channels: 3 },
    })
      // 6 = rotate 90° clockwise, so the intended shape is portrait.
      // `withMetadata` rather than `withExif`: the orientation is a first-class
      // field sharp writes itself, and setting it as a raw IFD0 tag is
      // overwritten by the encoder.
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();

    const derived = await deriveFromBuffer(sideways);

    // Rotated: the 4200 px axis became the vertical one and was clamped.
    expect(derived.height).toBe(DISPLAY_MAX_EDGE);
    expect(derived.width).toBe(DISPLAY_MAX_EDGE / 2);

    const meta = await sharp(derived.display).metadata();
    expect(meta.orientation).toBeUndefined();
  });
});
