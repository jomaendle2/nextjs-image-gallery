/**
 * What a photographer is allowed to tell the model, and what leaves the
 * server when they do.
 *
 * A hint is the one part of this feature where data travels *outward* on
 * purpose. Everything else the provider sees is a photograph the
 * photographer chose to publish and the exposure line their camera wrote;
 * this is a sentence they typed and, when they ask for it, a point they
 * clicked. So it gets its own module, and the module is pure — the rule
 * about how blunt a coordinate has to be before it goes anywhere is the kind
 * of rule that has to be readable on its own and testable without a network.
 *
 * Nothing here is ever stored. A hint exists for the length of one request:
 * it steers a guess and is then gone, which is why the box it comes from has
 * no `name` attribute and is not part of the form that gets saved.
 */

import { MAX_LOCATION } from "@/lib/photos/caps";
import type { Pin } from "@/lib/photos/types";
import { clamp } from "./suggestion";

/**
 * How much of a coordinate a prompt may carry: one decimal place, about
 * 11 km at the equator and less everywhere else.
 *
 * **Deliberately not `coarsen()`.** That function is pinned by I15 to two
 * files and its cell size is frozen against every dot already drawn on the
 * globe — borrowing it here would couple a prompt to a number that must
 * never move, and would add a call site to the one function the invariant
 * exists to keep single. The jobs are different too: a published dot is
 * stored for ever and must be stable, and this is a steer that lives for one
 * request and is never drawn. Naming a coastline does not need more, and a
 * photographer who clicks precisely on their own house should not have that
 * leave the server.
 */
const HINT_PLACES = 10;

/** What the photographer said, and roughly where they pointed. */
export interface Hint {
  note: string | null;
  near: Pin | null;
}

/** Nothing said, nothing pointed at. The common case, and never an error. */
const NO_HINT: Hint = { note: null, near: null };

function blunt(value: number): number {
  return Math.round(value * HINT_PLACES) / HINT_PLACES;
}

/**
 * A point from a request body, validated and then made blunt.
 *
 * The rounding happens here rather than at the call site so that there is no
 * path from a request to a prompt that skips it. `hintLine` reads only what
 * this function returned.
 */
function readNear(value: unknown): Pin | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const { lat, lng } = value as { lat?: unknown; lng?: unknown };
  if (typeof lat !== "number" || typeof lng !== "number") {
    return null;
  }
  if (!(Number.isFinite(lat) && Number.isFinite(lng))) {
    return null;
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }
  return { lat: blunt(lat), lng: blunt(lng) };
}

/**
 * Whatever arrived in the body, turned into a hint or into nothing.
 *
 * Malformed JSON, an absent field, a body that is not an object at all and a
 * request with no body whatsoever all land on the same answer. A hint is
 * optional by construction, so a bad one is not worth an error page — the
 * photographer pressed a button expecting a suggestion, and the useful
 * response to a hint we cannot read is the suggestion without it.
 *
 * The note is cut to the cap the location column has. It is the
 * photographer's own words about their own photograph, shown straight back
 * to them and never stored — but it is still text going into a prompt, so it
 * is cut rather than trusted for length.
 */
export function readHint(body: unknown): Hint {
  if (typeof body !== "object" || body === null) {
    return NO_HINT;
  }
  const { note, near } = body as { note?: unknown; near?: unknown };
  const said = typeof note === "string" ? clamp(note, MAX_LOCATION) : "";

  return { note: said === "" ? null : said, near: readNear(near) };
}

/**
 * The hint as a line of prompt, or nothing at all.
 *
 * A sentence rather than a labelled field, because it is going into a
 * message beside "Suggest a title, a description and a place" and reads as
 * part of it. It says *roughly* out loud: the model is being told the
 * neighbourhood, and a number to one decimal place presented as a fact would
 * invite it to hand the same precision back.
 */
export function hintLine(hint: Hint): string | null {
  const parts: string[] = [];

  if (hint.note !== null) {
    parts.push(`they say it is ${hint.note}`);
  }
  if (hint.near !== null) {
    parts.push(`they pointed at roughly ${hint.near.lat}, ${hint.near.lng}`);
  }

  return parts.length === 0
    ? null
    : `The photographer offers a hint: ${parts.join("; ")}. ` +
        "Treat it as a steer rather than an answer — name the place they " +
        "mean if the frame agrees with it, and say so if it does not.";
}
