"use client";

import { useEffect, useRef } from "react";
import { WORLD_RINGS } from "@/lib/geo/world";
import type { GlobePoint } from "@/lib/photos/globe";
import { prefersReducedMotion } from "@/lib/prefers-reduced-motion";

/**
 * The globe, as an enhancement over the list that is already on the page.
 *
 * About forty lines of orthographic projection and no dependency at all.
 * Rejected, and why: `cobe` (~28 KB, and a SaaS-landing-page look that
 * introduces colour this design system has no token for), `globe.gl` (pulls
 * three.js, ~600 KB), `d3-geo` (~28 KB and genuinely good — worth adding
 * only if filled landmasses are ever wanted).
 *
 * **Coastlines as strokes, not fills.** Clipping a polygon correctly at the
 * limb is the genuinely hard part of drawing a globe: a ring that crosses
 * the horizon has to be closed along the horizon itself, and getting it
 * wrong makes continents flicker inside out as the sphere turns. With open
 * strokes a dropped vertex merely shortens a line, which nobody sees. The
 * cheap version of the right idea beats the expensive version of the wrong
 * one here, because this is an ornament over a list that already works.
 *
 * Colour comes from one Tailwind class on the canvas and is read back with
 * `getComputedStyle`. A canvas cannot read a class, and assigning a hex
 * literal to `strokeStyle` is exactly what `design.test.ts` forbids — so the
 * element carries the colour and the drawing varies only its alpha. (That
 * test reads raw source, comments included, which is why this paragraph
 * describes the literal rather than showing one.)
 */

/** Degrees turned per second. Slow enough to read, fast enough to notice. */
const SPIN_PER_SECOND = 4;

/** Fraction of the canvas the sphere fills, leaving room for a dot at the edge. */
const FILL = 0.92;

const ALPHA_COASTLINE = 0.16;
const ALPHA_SPHERE = 0.04;
const ALPHA_HALO = 0.3;

const DOT_RADIUS = 2.6;
const HALO_RADIUS = 7;

const TO_RADIANS = Math.PI / 180;

interface Projected {
  x: number;
  y: number;
  /** True when the point is on the near side of the sphere. */
  visible: boolean;
}

/**
 * Orthographic: the view from infinitely far away, which is what a globe
 * looks like. `cos(c)` is the cosine of the angular distance from the point
 * facing the viewer, so its sign is the whole visibility test.
 */
function project(
  lat: number,
  lng: number,
  spin: number,
  radius: number,
): Projected {
  const phi = lat * TO_RADIANS;
  const lambda = (lng + spin) * TO_RADIANS;
  const cosPhi = Math.cos(phi);
  return {
    x: radius * cosPhi * Math.sin(lambda),
    // Screen y grows downward; latitude grows upward.
    y: -radius * Math.sin(phi),
    visible: cosPhi * Math.cos(lambda) > 0,
  };
}

function drawCoastlines(
  context: CanvasRenderingContext2D,
  spin: number,
  radius: number,
): void {
  context.globalAlpha = ALPHA_COASTLINE;
  context.beginPath();
  for (const ring of WORLD_RINGS) {
    let drawing = false;
    for (let index = 0; index < ring.length; index += 2) {
      const lng = ring[index] ?? 0;
      const lat = ring[index + 1] ?? 0;
      const point = project(lat, lng, spin, radius);
      if (!point.visible) {
        // Lift the pen at the limb rather than clipping. See the note above.
        drawing = false;
      } else if (drawing) {
        context.lineTo(point.x, point.y);
      } else {
        context.moveTo(point.x, point.y);
        drawing = true;
      }
    }
  }
  context.stroke();
}

function drawPoints(
  context: CanvasRenderingContext2D,
  points: readonly GlobePoint[],
  spin: number,
  radius: number,
): void {
  for (const point of points) {
    const at = project(point.lat, point.lng, spin, radius);
    if (at.visible) {
      /*
       * The halo is the uncertainty, exactly as in `WorldDot`: these are
       * cell centres, and a bare dot would draw honest arithmetic as a
       * precise claim.
       */
      context.globalAlpha = ALPHA_HALO;
      context.beginPath();
      context.arc(at.x, at.y, HALO_RADIUS, 0, Math.PI * 2);
      context.fill();

      context.globalAlpha = 1;
      context.beginPath();
      context.arc(at.x, at.y, DOT_RADIUS, 0, Math.PI * 2);
      context.fill();
    }
  }
}

export function GlobeCanvas({ points }: { points: readonly GlobePoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  /*
   * The points are read through a ref, so the animation loop is created once
   * and a re-render cannot restart it mid-turn.
   */
  const latest = useRef(points);
  latest.current = points;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas === null || !context) {
      return;
    }

    /*
     * Colour from the element's own computed `color`, which the Tailwind
     * class on the canvas sets. Everything below varies alpha rather than
     * introducing a second colour — this page is a list of somebody's
     * photographs by place, and the globe is not the subject.
     */
    const ink = globalThis.getComputedStyle(canvas).color;
    context.strokeStyle = ink;
    context.fillStyle = ink;
    context.lineWidth = 1;
    context.lineJoin = "round";

    let frame = 0;
    let start: number | null = null;
    const still = prefersReducedMotion();

    const size = () => {
      const ratio = Math.min(globalThis.devicePixelRatio || 1, 2);
      const box = canvas.getBoundingClientRect();
      canvas.width = Math.round(box.width * ratio);
      canvas.height = Math.round(box.height * ratio);
      return { ratio, width: box.width, height: box.height };
    };

    const render = (time: number) => {
      start ??= time;
      const { ratio, width, height } = size();
      const radius = (Math.min(width, height) / 2) * FILL;

      /*
       * `setTransform` rather than accumulating translations: the canvas is
       * resized every frame to follow the element, and resizing resets the
       * context, so state has to be re-established rather than adjusted.
       */
      context.setTransform(
        ratio,
        0,
        0,
        ratio,
        (width / 2) * ratio,
        (height / 2) * ratio,
      );
      context.clearRect(-width, -height, width * 2, height * 2);
      context.strokeStyle = ink;
      context.fillStyle = ink;
      context.lineWidth = 1;

      const spin = still ? 0 : ((time - start) / 1000) * SPIN_PER_SECOND;

      // The sphere itself, so the dark side reads as a globe rather than a gap.
      context.globalAlpha = ALPHA_SPHERE;
      context.beginPath();
      context.arc(0, 0, radius, 0, Math.PI * 2);
      context.fill();

      drawCoastlines(context, spin, radius);
      drawPoints(context, latest.current, spin, radius);
      context.globalAlpha = 1;

      /*
       * One frame and stop when the reader asked for reduced motion. Not a
       * slower spin — a globe turning slowly is still a globe turning, and
       * the setting is a request to stop, not to be gentle about it.
       */
      if (!still) {
        frame = requestAnimationFrame(render);
      }
    };

    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    /*
     * No label, and no fallback content inside it. A canvas with no children
     * is nothing to a screen reader, which is exactly right here: the
     * grouped list below is the same information, complete, in a form that
     * can actually be read out. A description saying "a globe with eleven
     * dots on it" would be a worse version of the list, announced first.
     */
    <canvas
      className="mx-auto block aspect-square w-full max-w-[460px] text-white"
      ref={canvasRef}
    />
  );
}
