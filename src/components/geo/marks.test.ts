import { describe, expect, it } from "vitest";
import { onSphere } from "./marks";

/**
 * The conversion three gestures depend on, which had no test while it was
 * written out three times.
 *
 * Everything about the sphere measures from the middle of the canvas;
 * the DOM measures from the top left of the viewport. Getting this wrong by
 * a factor of two does not throw — it aims the hit test and the zoom at the
 * wrong place, subtly, and only on a canvas that is not already centred in
 * the viewport. Which is why the fixtures below are deliberately offset.
 */
describe("onSphere", () => {
  /** A canvas at an awkward offset, so a dropped term cannot pass by luck. */
  const canvasAt = (
    left: number,
    top: number,
    width: number,
    height: number,
  ): HTMLElement =>
    ({
      getBoundingClientRect: () =>
        ({ left, top, width, height }) as unknown as DOMRect,
    }) as unknown as HTMLElement;

  it("reads the canvas centre as the origin", () => {
    const canvas = canvasAt(100, 40, 640, 480);
    // The middle of that box in client coordinates.
    const at = onSphere(canvas, 100 + 320, 40 + 240);
    expect(at.x).toBe(0);
    expect(at.y).toBe(0);
  });

  it("measures right and down as positive, like the screen does", () => {
    const canvas = canvasAt(100, 40, 640, 480);
    const at = onSphere(canvas, 100 + 320 + 50, 40 + 240 + 30);
    expect(at.x).toBe(50);
    expect(at.y).toBe(30);
  });

  it("subtracts the offset as well as the half-size", () => {
    /*
     * The failure this catches: dropping `box.left` works perfectly while
     * the canvas starts at x=0, which is exactly what a full-screen overlay
     * does — so the bug would hide in the expanded globe and appear only in
     * the small one on the page.
     */
    const flush = onSphere(canvasAt(0, 0, 640, 480), 320, 240);
    const offset = onSphere(canvasAt(200, 90, 640, 480), 200 + 320, 90 + 240);
    expect(offset).toMatchObject({ x: flush.x, y: flush.y });
  });

  it("hands back the box it measured, for the reverse conversion", () => {
    // The hover card converts the other way and must not take a second
    // reading — two reads can disagree if the layout moved between them.
    const canvas = canvasAt(100, 40, 640, 480);
    const at = onSphere(canvas, 300, 300);
    expect(at.box.width).toBe(640);
    expect(at.box.height).toBe(480);
    // Round-trip: centre-relative back to canvas-local, as `selectAt` does.
    expect(at.x + at.box.width / 2).toBe(300 - 100);
    expect(at.y + at.box.height / 2).toBe(300 - 40);
  });
});
