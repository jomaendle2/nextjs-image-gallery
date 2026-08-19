import { unproject } from "./projection";

/**
 * The magnification, and the stops it moves between.
 *
 * Its own file because three places need it and none of them is the other's
 * parent: the canvas clamps a wheel and a pinch with it, the chrome around
 * the canvas puts the stops on buttons and on `+`/`-`, and the keyboard
 * handler steps through them. A constant that three modules agree on is a
 * module, not an export borrowed from whichever of them was written first.
 */

/**
 * The magnifications, and the ceiling the wheel and the pinch stop at.
 *
 * `MAX_ZOOM` is where the data runs out rather than where the arithmetic
 * does, and the number is measured rather than assumed. A globe stops being
 * a coastline and starts being a polygon at the zoom where its vertices open
 * past roughly **2.7 CSS pixels** apart on screen — that figure is the whole
 * constraint, and everything below is arithmetic from it.
 *
 * Measured across the dataset by `scripts/build-world.mts`, in median degrees
 * between neighbouring vertices:
 *
 *   world-fine     0.245°  →  2.5x
 *   world-finest   0.055°  →  8x
 *   the raw source 0.014°  →  30x
 *
 * **More zoom is not a setting, it is more coastline.** That is worth saying
 * plainly because it looks like a constant somebody could have raised at any
 * point: raising it without the data underneath produces a smooth, confident
 * picture of vertices that were never surveyed, which is worse than refusing
 * to magnify — the reader cannot tell invented detail from measured detail.
 * The half-megabyte behind this number is what makes it honest.
 *
 * **And there is an end to it.** The last row is the raw Natural Earth 10m
 * source with no simplification at all, and 10m is the finest they publish.
 * So 30x is not a budget this could buy its way past; it is where this
 * dataset stops knowing anything, and going deeper would mean a different
 * source rather than a smaller tolerance.
 *
 * **But the coast is not what sets this number — the marks are, and they run
 * out first.** This ran at 16x for exactly one commit, on a coastline that
 * genuinely supports it, and the result was a globe full of dots in the wrong
 * places. `coarsen.ts` publishes a point up to 71km from where the
 * photograph was taken, deliberately and permanently. On screen that error is
 * about `2.5 * zoom` pixels against a dot whose halo is 11 across: inside the
 * dot at 4x, twice it at 8x, four times it at 16x. Past here the land keeps
 * getting sharper while the pins visibly wander off the places they name, and
 * a globe that invites a closer look at a dot it cannot place is making a
 * promise the privacy model deliberately breaks.
 *
 * So 8x is a compromise rather than a limit: one stop past where the marks
 * are truly comfortable, because the coast at 8x is worth looking at and the
 * drift there is still small enough to read as a dot sitting *near* a place
 * rather than in the wrong one. It is not a number the data forced.
 *
 * **The stops double.** They used to add one — 1 through 6 in steps of half,
 * then of one — on the rule that "+" should always mean the same amount of
 * closer. Over a range this long that rule inverts itself: even steps would
 * make the first press a doubling and the last a fractional nudge. Doubling
 * is what "the same amount of closer" means for a magnification, and it is
 * the way `focusedView` already reasons about the range — see the note there
 * about measuring progress multiplicatively. Three presses cross the whole
 * range, and each one does the same thing.
 *
 */
export const ZOOM_STOPS = [1, 2, 4, 8] as const;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;

/**
 * The zoom past which `world-fine` is no longer enough.
 *
 * `GlobeCanvas` watches this to decide when to fetch `world-finest`, so the
 * half-megabyte is spent by the reader who zooms rather than by the one who
 * opens the globe. Set at the old ceiling, which is precisely where the old
 * data stopped having anything more to say.
 */
export const FINEST_FROM = 2.5;

export const WHEEL_ZOOM = 0.0015;

/** Firefox reports wheel deltas in lines rather than pixels. */
export const LINE_HEIGHT = 16;

export function clampZoom(value: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

/** The next stop up, or back to the first once past the last. */
export function nextZoomStop(from: number): number {
  const next = ZOOM_STOPS.find((stop) => stop > from + 0.01);
  return next ?? ZOOM_STOPS[0];
}

/** The next stop down, or the first. */
export function previousZoomStop(from: number): number {
  const below = ZOOM_STOPS.filter((stop) => stop < from - 0.01);
  return below.at(-1) ?? ZOOM_STOPS[0];
}

/**
 * Where to turn the globe so that magnifying arrives at what the reader
 * pointed at.
 *
 * Zoom on this globe scales the sphere about its own centre — the porthole is
 * fixed, so magnifying fills the same circle with more earth. That makes the
 * centre pixel the only thing anybody can actually zoom *into*, and the
 * centre is usually open ocean: wheeling over South America magnified the
 * Atlantic and pushed South America off the frame. The gesture pointed at one
 * thing and the sphere delivered another.
 *
 * A globe cannot pan the way a map does, because the sphere stays centred. So
 * the analogue of "zoom towards the cursor" is to *rotate* towards it: the
 * view turns a share of the way to `target`, and the share is the share of
 * the *remaining* range this step consumed. A wheel run from 1 to `MAX_ZOOM`
 * therefore arrives with the target centred, and a single notch moves it a
 * little.
 *
 * **`target` is passed in rather than unprojected here, and that is the
 * whole of what makes the sentence above true.** This function used to take
 * a pointer and read the point under it each time, which is correct for one
 * step and wrong for the sequence a real wheel produces: every step rotates
 * the globe, so the next step read a *different* place under the same pixel
 * and aimed at that instead. It chased a moving point. Measured over a fixed
 * pointer, ten notches left the original target 231 pixels off centre —
 * further out than five notches had. Anchoring it once per gesture converges
 * to nothing: the caller captures the target when a zoom begins and holds it
 * until the gesture ends.
 *
 * Returns null, and the caller leaves the view alone, when there is nothing
 * to aim at: zooming out is a request to see more, and turning at the same
 * time moves what somebody is trying to get their bearings on.
 *
 * Pure, and separated from the gesture plumbing that calls it, because it is
 * the only part with arithmetic worth checking on its own.
 */
export function focusedView({
  from,
  to,
  target,
  tiltLimit,
}: {
  /** The view as it stands, and the magnification it stands at. */
  from: { spin: number; tilt: number; zoom: number };
  /** The magnification being moved to. */
  to: number;
  /** Where the gesture is aimed, fixed for its whole duration. */
  target: { lat: number; lng: number };
  /** How far from the equator the view may lean, from the caller's own rule. */
  tiltLimit: number;
}): { spin: number; tilt: number } | null {
  if (to <= from.zoom) {
    return null;
  }

  /*
   * How much of what was left of the range this step used. At the top there
   * is nothing left to consume, so the share is forced to one and the last
   * step lands the target dead centre rather than asymptotically near it.
   *
   * **Measured multiplicatively, because zoom is multiplicative.** A wheel
   * notch scales the magnification rather than adding to it, and the sphere's
   * radius scales with it — so what "half way there" means has to be counted
   * the same way, or the turning falls behind the growing.
   *
   * The linear version of this line was correct while the range ran 1 to 2.5
   * and wrong the moment it ran to 6, in a way that only a longer range
   * exposes: the residual angle a step leaves behind is multiplied by a
   * radius that keeps growing, so a target could sit further from the middle
   * in pixels after forty notches than after twenty while the angle between
   * them quietly shrank. `zoom.test.ts` measures pixels, which is what the
   * reader sees, and it caught this.
   */
  const span = Math.log(MAX_ZOOM / from.zoom);
  const progress =
    span <= 0.001 ? 1 : Math.min(1, Math.log(to / from.zoom) / span);

  /*
   * A floor under that share, tied to how much bigger the sphere just got.
   *
   * Magnifying multiplies the radius, so a target left off-centre is carried
   * further from the middle *in pixels* by the same step that brought it
   * closer *in degrees*. `1 - from/to` is the share at which those two
   * exactly cancel for a target near the middle, where the projection is
   * close to linear in the angle.
   *
   * It does not cancel them near the limb, and it is worth being exact about
   * that rather than claiming a guarantee: out there the projection is a
   * sine, it flattens, and a target that starts most of a hemisphere away
   * still drifts outward in pixels for the first few notches before coming
   * back — measured, over a wheel run from 1 to 6, it peaks about a sixth
   * further out around the third notch and is dead centre by the tenth.
   *
   * What the floor buys is a much smaller hump: without it the same run
   * peaks nearly twice as far out. What guarantees the arrival is `progress`
   * reaching one at the top of the range. The two together are why
   * `zoom.test.ts` can assert that the *angle* never grows.
   */
  const share = Math.min(1, Math.max(progress, 1 - from.zoom / to));

  /*
   * Spin is cyclic, and the way round matters: +350 degrees and -10 put the
   * same place in the middle, and one of them spins the earth almost all the
   * way round on a scroll notch.
   */
  let delta = (-target.lng - from.spin) % 360;
  if (delta > 180) {
    delta -= 360;
  }
  if (delta < -180) {
    delta += 360;
  }

  const wantTilt = Math.max(-tiltLimit, Math.min(tiltLimit, target.lat));
  return {
    spin: from.spin + delta * share,
    tilt: from.tilt + (wantTilt - from.tilt) * share,
  };
}

/**
 * How far a pointer may wander and still count as the same zoom gesture.
 *
 * A wheel has no beginning or end to hook onto, so "still aiming at the same
 * place" is decided by the pointer not having moved. A few pixels of slack
 * covers a hand resting on a trackpad; past that the reader has chosen
 * somewhere else and the aim is recaptured.
 */
const ANCHOR_SLACK = 6;

/**
 * Remembers what a zoom gesture is aimed at, so a run of notches converges.
 *
 * The state is the whole point, and it is why this is a factory rather than a
 * function. `focusedView` turns the view a share of the way towards a target;
 * if that target is re-read from under the pointer on every notch, each step
 * aims at whatever the *previous* step rotated into place, and the gesture
 * chases a moving point instead of arriving at one. Measured over a fixed
 * pointer, that left the original target 231 pixels off centre after ten
 * notches — further out than after five.
 *
 * One anchor per gesture fixes it. There is no event that marks a wheel
 * gesture ending, so the anchor is kept while the pointer stays within
 * `ANCHOR_SLACK` and recaptured when it does not; `forget` covers the cases
 * that have an event — a drag, which moves the globe out from under the
 * anchor and makes its coordinates describe the wrong pixel.
 */
export function createAim(): {
  /**
   * The view to move to, or null to leave it alone. One call rather than
   * "find the target, then focus on it", because the two only ever happen
   * together and splitting them left the caller juggling two nullables.
   */
  towards: (input: {
    pointer: { x: number; y: number };
    from: { spin: number; tilt: number; zoom: number };
    to: number;
    porthole: number;
    tiltLimit: number;
  }) => { spin: number; tilt: number } | null;
  forget: () => void;
} {
  let anchor: {
    at: { x: number; y: number };
    lat: number;
    lng: number;
  } | null = null;

  return {
    towards({ pointer, from, to, porthole, tiltLimit }) {
      const held =
        anchor !== null &&
        Math.hypot(pointer.x - anchor.at.x, pointer.y - anchor.at.y) <=
          ANCHOR_SLACK;

      if (!held) {
        const found = unproject(pointer.x, pointer.y, {
          radius: porthole * from.zoom,
          spin: from.spin,
          tilt: from.tilt,
        });
        anchor =
          found === null
            ? null
            : { at: pointer, lat: found.lat, lng: found.lng };
      }

      return anchor === null
        ? null
        : focusedView({
            from,
            target: { lat: anchor.lat, lng: anchor.lng },
            tiltLimit,
            to,
          });
    },
    forget() {
      anchor = null;
    },
  };
}
