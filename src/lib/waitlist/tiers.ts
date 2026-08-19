import { MEMBERSHIP } from "@/lib/legal";

/**
 * The price ladder, in one place, including the two rungs that do not exist.
 *
 * `/pricing` is a demand test before it is a shop. Two of the four tiers here
 * are unbuilt, and the page says so in those words rather than in a badge —
 * a "coming soon" pill beside a price is how a reader ends up believing they
 * could buy it today, and a register of people who thought they were buying
 * something is not a measurement of anything.
 *
 * The tiers are data rather than markup for the ordinary reason — the page
 * renders them in a loop and a fifth would otherwise be a fifth block of
 * copied JSX — and for one that matters more here: `EARLY_ACCESS` is derived
 * from this list, so the set of tiers a form will accept cannot drift from
 * the set the page displays. A tier added here is offered and accepted in
 * the same commit or in neither.
 */

/** A tier somebody can register interest in, because it is not built. */
export type EarlyAccessTier = "pro" | "spaces";

interface Tier {
  /** Stored against a request, so it is a slug rather than a title. */
  id: string;
  name: string;
  /**
   * The small-caps line above the name, which says what kind of rung this
   * is rather than what it costs — "proposed" is the word the whole page
   * turns on and it belongs where somebody skimming will hit it first.
   */
  label: string;
  /** The figure, and what it buys per unit of time. */
  price: string;
  /**
   * The second line under the price, where one is needed.
   *
   * It exists because the first version of this put "or €45 a year" in the
   * label slot, and the card then read "or €45 a year / Member / €5 a month"
   * — an "or" three lines above the price it modifies. A qualifier has to sit
   * under the thing it qualifies or it is not a qualifier.
   */
  priceNote?: string;
  /** Who this is for, in one line, addressed to them. */
  who: string;
  /** What it includes. Written as promises, so the unbuilt ones are drafts. */
  includes: readonly string[];
  /**
   * The honest limit. Every tier has one and every tier states it.
   *
   * This field is the reason the page is worth publishing at all. A pricing
   * table where each column lists only what it gives you is a table nobody
   * believes, and this site has spent its whole membership page proving it
   * will say the awkward part.
   */
  limit: string;
  /**
   * `live` can be bought now. `draft` cannot be bought at all — it is a
   * proposal with a form under it.
   */
  status: "live" | "draft";
}

export const TIERS: readonly Tier[] = [
  {
    id: "free",
    name: "The gallery",
    label: "always free",
    price: "Free",
    who: "Anybody who wants to look.",
    includes: [
      "Every photograph, at full size, with no account",
      "The globe, and roughly where each photograph was taken",
      "The feeds, and the email list if you want one",
    ],
    limit:
      "Roughly means roughly: the globe places a photograph inside a square about a hundred kilometres across.",
    status: "live",
  },
  {
    id: "member",
    name: "Member",
    label: "on sale now",
    price: `${MEMBERSHIP.price} a ${MEMBERSHIP.interval}`,
    priceNote: `or ${MEMBERSHIP.annualPrice} a ${MEMBERSHIP.annualInterval}, which is ${MEMBERSHIP.annualSaving} less`,
    who: "Anybody who wants to know where a photograph was taken, and how.",
    includes: [
      "The exact place, on a map, under every photograph that has one",
      "The photographer's own notes on how the picture was made",
      "Cancel in one click, no notice period",
    ],
    limit:
      "Not every photograph has either. A photographer fills both in by hand, and some leave them empty.",
    status: "live",
  },
  {
    id: "pro",
    name: "Pro",
    label: "proposed",
    price: "€25 a month",
    who: "Photographers who travel to shoot, and plan trips around light.",
    includes: [
      "Sun, moon and tide for the exact spot, on any date you pick",
      "How to reach it: the drive, the walk, the permit, the parking",
      "Export a shortlist to GPX or your phone's map before you go",
      "New locations every month, or it is not worth paying for",
    ],
    limit:
      "This does not exist yet, and the last line is the hard one. A gallery this small has dozens of places in it, not thousands.",
    status: "draft",
  },
  {
    id: "spaces",
    name: "Spaces",
    label: "proposed",
    price: "€39 a month",
    priceNote: "per screen, less above ten",
    who: "Hotels, studios, clinics and offices with a screen on a wall.",
    includes: [
      "A full-screen gallery built to run all day without burning a panel in",
      "Keeps playing when the wi-fi drops",
      "Playlists that change with the season, curated rather than shuffled",
      "A licence that covers showing the work in a commercial space",
      "One account, however many screens; invoice or SEPA rather than a card",
    ],
    limit:
      "This does not exist yet either, and the licence is the part that gates it — see below.",
    status: "draft",
  },
];

/** The tiers a form may accept a request for: exactly the unbuilt ones. */
export const EARLY_ACCESS: readonly EarlyAccessTier[] = ["pro", "spaces"];

export function isEarlyAccessTier(value: string): value is EarlyAccessTier {
  return (EARLY_ACCESS as readonly string[]).includes(value);
}

/** The title to show for a stored request, which holds only the slug. */
export function tierName(tier: EarlyAccessTier): string {
  return TIERS.find((candidate) => candidate.id === tier)?.name ?? tier;
}
