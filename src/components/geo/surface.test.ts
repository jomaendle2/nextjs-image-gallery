import { describe, expect, it } from "vitest";
import { drawRatio, fitSurface } from "./surface";

/**
 * The guard, pinned, because it looks like a redundant comparison.
 *
 * `fitSurface` reads as "set the size if it is not already the size", which
 * is the kind of check somebody removes on the grounds that assigning the
 * same value is free. It is not free here: assigning `canvas.width` resets
 * the canvas whatever the value, so removing this reallocates a
 * multi-megapixel bitmap on every frame of a sixty-frame-a-second globe.
 *
 * A test cannot observe a reset directly, so it observes the writes instead
 * — a stand-in that counts how many times each field is assigned.
 */
function surface(width: number, height: number) {
  const writes = { width: 0, height: 0 };
  const canvas = {
    _width: width,
    _height: height,
    get width() {
      return this._width;
    },
    set width(value: number) {
      writes.width += 1;
      this._width = value;
    },
    get height() {
      return this._height;
    },
    set height(value: number) {
      writes.height += 1;
      this._height = value;
    },
  };
  return { canvas, writes };
}

describe("fitSurface", () => {
  it("does not touch a canvas that is already the right size", () => {
    const { canvas, writes } = surface(1024, 1024);
    expect(fitSurface(canvas, 512, 512, 2)).toBe(false);
    expect(writes).toEqual({ width: 0, height: 0 });
  });

  it("resizes when the box changed, and says that it did", () => {
    const { canvas, writes } = surface(1024, 1024);
    expect(fitSurface(canvas, 512, 400, 2)).toBe(true);
    expect(canvas.width).toBe(1024);
    expect(canvas.height).toBe(800);
    /*
     * Both assigned, though only the height changed — and that is not worth
     * avoiding. The reset this function exists to prevent has already
     * happened the moment the height is written, so skipping the width would
     * save an assignment and no work at all.
     */
    expect(writes).toEqual({ width: 1, height: 1 });
  });

  it("rounds, because a bitmap has no half pixels", () => {
    const { canvas } = surface(0, 0);
    fitSurface(canvas, 511.4, 511.6, 1);
    expect(canvas.width).toBe(511);
    expect(canvas.height).toBe(512);
  });

  it("stays put across repeated frames at one size", () => {
    const { canvas, writes } = surface(0, 0);
    for (let frame = 0; frame < 60; frame += 1) {
      fitSurface(canvas, 512, 512, 2);
    }
    // One frame's worth of writes, not sixty.
    expect(writes).toEqual({ width: 1, height: 1 });
  });
});

describe("drawRatio", () => {
  it("caps at two", () => {
    expect(drawRatio(3)).toBe(2);
  });

  it("keeps an ordinary display's own ratio", () => {
    expect(drawRatio(1)).toBe(1);
    expect(drawRatio(1.5)).toBe(1.5);
  });

  it("survives a browser that reports nothing useful", () => {
    expect(drawRatio(0)).toBe(1);
    expect(drawRatio(Number.NaN)).toBe(1);
  });
});
