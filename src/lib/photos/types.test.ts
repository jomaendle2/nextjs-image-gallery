import { describe, expect, it } from "vitest";
import { exifParam } from "./types";

/**
 * `types.ts` is types and one function, and this covers the function.
 *
 * These assertions used to live in `derive.test.ts`, next to the EXIF
 * reading they belong to by subject. They moved with the code: `exifParam`
 * is now in `types.ts` precisely so that nothing which merely *stores* EXIF
 * has to load `sharp` and `exifr` to do it, and a test importing it from the
 * old home would have quietly kept the two coupled in one more place.
 */
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
