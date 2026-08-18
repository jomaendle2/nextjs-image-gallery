import { describe, expect, it } from "vitest";
import { project } from "./projection";
import {
  clampZoom,
  focusedView,
  MAX_ZOOM,
  MIN_ZOOM,
  nextZoomStop,
  previousZoomStop,
  ZOOM_STOPS,
} from "./zoom";

const PORTHOLE = 320;
const TILT_LIMIT = 80;

describe("the zoom stops", () => {
  it("runs from the whole earth to where the coastline runs out", () => {
    expect(ZOOM_STOPS[0]).toBe(MIN_ZOOM);
    expect(ZOOM_STOPS.at(-1)).toBe(MAX_ZOOM);
  });

  it("climbs in even steps, so no press is a bigger jump than another", () => {
    /*
     * The first version went 1 → 1.6 → 2.5: a small step then a large one,
     * and the large one is where a reader loses their place. Even steps mean
     * "+" always means the same amount of closer.
     */
    const gaps = ZOOM_STOPS.slice(1).map(
      (stop, i) => stop - (ZOOM_STOPS[i] ?? 0),
    );
    const [first] = gaps;
    expect(first).toBeDefined();
    for (const gap of gaps) {
      expect(gap).toBeCloseTo(first ?? 0, 6);
    }
    expect(gaps.length).toBeGreaterThanOrEqual(3);
  });

  it("steps up and down through every stop, and wraps at the top", () => {
    expect(nextZoomStop(1)).toBe(1.5);
    expect(nextZoomStop(1.5)).toBe(2);
    expect(nextZoomStop(2)).toBe(2.5);
    // Past the last, back to the whole earth — one press to start again.
    expect(nextZoomStop(2.5)).toBe(1);
    expect(previousZoomStop(2.5)).toBe(2);
    expect(previousZoomStop(1)).toBe(1);
  });

  it("never lets a wheel past either end", () => {
    expect(clampZoom(99)).toBe(MAX_ZOOM);
    expect(clampZoom(-4)).toBe(MIN_ZOOM);
  });
});

/**
 * The whole point of `focusedView`: after zooming, the thing the reader
 * pointed at should be nearer the middle than it was — and at the top of the
 * range, dead centre.
 */
describe("focusedView", () => {
  const from = { spin: 0, tilt: 20, zoom: 1 };

  /** Where a lat/lng lands, in centre-relative pixels, at a given view. */
  const screen = (
    view: { spin: number; tilt: number },
    zoom: number,
    lat: number,
    lng: number,
  ) => project(lat, lng, { ...view, radius: PORTHOLE * zoom });

  /** What the caller would have captured by pointing at `lat`/`lng`. */
  const aim = (lat: number, lng: number) => ({ lat, lng });

  it("brings the point under the pointer to the centre at full zoom", () => {
    // Somewhere off-centre and unmistakably on the disc.
    const target = { lat: -20, lng: 35 };
    const aimed = focusedView({
      from,
      target,
      tiltLimit: TILT_LIMIT,
      to: MAX_ZOOM,
    });

    expect(aimed).not.toBeNull();
    const landed = screen(aimed ?? from, MAX_ZOOM, target.lat, target.lng);
    expect(landed.x).toBeCloseTo(0, 3);
    expect(landed.y).toBeCloseTo(0, 3);
  });

  it("moves part of the way for part of the range", () => {
    const target = { lat: -20, lng: 35 };
    const at = screen(from, from.zoom, target.lat, target.lng);
    const before = Math.hypot(at.x, at.y);

    const aimed = focusedView({
      from,
      target,
      tiltLimit: TILT_LIMIT,
      to: 1.5,
    });
    expect(aimed).not.toBeNull();

    /*
     * Measured at zoom 1 both times, so this compares the *rotation* rather
     * than the magnification — otherwise a bigger sphere would flatter the
     * result and the test would pass with no turning at all.
     */
    const after = screen(aimed ?? from, from.zoom, target.lat, target.lng);
    expect(Math.hypot(after.x, after.y)).toBeLessThan(before);
    // Part of the way, not all of it.
    expect(Math.hypot(after.x, after.y)).toBeGreaterThan(1);
  });

  it("does not steer when zooming out", () => {
    // Pulling back is a request to see more; turning at the same time moves
    // what the reader is trying to get their bearings on.
    expect(
      focusedView({
        from: { ...from, zoom: 2.5 },
        target: aim(-20, 35),
        tiltLimit: TILT_LIMIT,
        to: 1.5,
      }),
    ).toBeNull();
  });

  it("does nothing when the magnification does not change", () => {
    expect(
      focusedView({
        from,
        target: aim(-20, 35),
        tiltLimit: TILT_LIMIT,
        to: from.zoom,
      }),
    ).toBeNull();
  });

  it("never leans past the caller's tilt limit", () => {
    // A pointer near the pole would otherwise ask for a tilt of ±90, where
    // the globe is edge-on to its own axis.
    const aimed = focusedView({
      from,
      target: aim(88, 0),
      tiltLimit: TILT_LIMIT,
      to: MAX_ZOOM,
    });
    expect(Math.abs(aimed?.tilt ?? 0)).toBeLessThanOrEqual(TILT_LIMIT);
  });

  it("turns the short way round", () => {
    /*
     * Spin is cyclic. Aiming at a point just west of the meridian from a view
     * just east of it must cross the meridian, not travel 350 degrees the
     * other way — which on a scroll notch would spin the earth almost fully
     * round.
     */
    const start = { spin: 170, tilt: 0, zoom: 1 };
    const aimed = focusedView({
      from: start,
      target: aim(0, -175),
      tiltLimit: TILT_LIMIT,
      to: MAX_ZOOM,
    });
    expect(Math.abs((aimed?.spin ?? 0) - start.spin)).toBeLessThan(180);
  });
});

/**
 * The sequence a real wheel produces, which is where the first version was
 * wrong.
 *
 * A single call from 1 to `MAX_ZOOM` was tested and passed; a wheel does not
 * do that. It sends a stream of small notches, and the earlier design read
 * the point under the pointer afresh on each one — so every step, having
 * just rotated the globe, aimed at a *different* place. It chased a moving
 * point. Ten notches over a fixed pointer left the original target 231
 * pixels off centre, further out than five had.
 *
 * Anchoring the target for the gesture is what fixes it, and this is the
 * test that tells the two designs apart.
 */
describe("focusedView over a run of notches", () => {
  const WHEEL_NOTCH = Math.exp(120 * 0.0015);

  /** Wheel `notches` times towards one fixed target, as `gestures` does. */
  const wheelTowards = (
    target: { lat: number; lng: number },
    notches: number,
  ) => {
    const view = { spin: 0, tilt: 20, zoom: 1 };
    for (let i = 0; i < notches; i += 1) {
      const to = Math.min(MAX_ZOOM, view.zoom * WHEEL_NOTCH);
      const aimed = focusedView({
        from: view,
        target,
        tiltLimit: TILT_LIMIT,
        to,
      });
      if (aimed !== null) {
        view.spin = aimed.spin;
        view.tilt = aimed.tilt;
      }
      view.zoom = to;
    }
    return view;
  };

  it("converges: more notches never leave the target further out", () => {
    const target = { lat: -35, lng: -60 };
    const offsets = [1, 5, 10, 20, 40].map((notches) => {
      const view = wheelTowards(target, notches);
      const at = project(target.lat, target.lng, {
        ...view,
        radius: PORTHOLE * view.zoom,
      });
      return Math.hypot(at.x, at.y);
    });

    for (const [i, offset] of offsets.entries()) {
      if (i > 0) {
        expect(offset).toBeLessThanOrEqual((offsets[i - 1] ?? 0) + 0.001);
      }
    }
    // And it actually arrives, rather than merely not getting worse.
    expect(offsets.at(-1)).toBeCloseTo(0, 6);
  });
});
