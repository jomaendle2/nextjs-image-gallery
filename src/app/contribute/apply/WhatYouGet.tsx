import {
  BODY_SMALL,
  ITEM_HEADING,
  SECTION_HEADING,
} from "@/components/ui/field";
import { TextLink } from "@/components/ui/TextLink";

interface Offer {
  title: string;
  detail: string;
}

/**
 * Every line here is a promise the code already keeps.
 *
 * The page used to describe only the gallery's side of the bargain — small,
 * invited, show us your work — which asks a photographer for their best
 * photographs and their email address in exchange for nothing stated. These
 * four things were all true before this section existed; they were simply
 * never said out loud, which is the cheapest kind of value to leave on the
 * table.
 *
 * If any of them stops being true, this list is wrong and has to change.
 * That is the point of keeping them specific rather than writing the usual
 * "join our community of passionate creators".
 */
const OFFERS: readonly Offer[] = [
  {
    title: "A page that is yours",
    detail:
      "Your photographs full-screen at a URL with your name on it, listed among the photographers. Somewhere worth linking to from your own site.",
  },
  {
    title: "Your name on every photograph",
    detail:
      "Your name sits on every photograph wherever it appears, linking out to your own site. Nothing here is published anonymously.",
  },
  /*
   * Not "GPS is stripped from every upload", which the bullet
   * directly below it contradicted: the original is kept exactly as sent,
   * and stripping it would mean altering the file we promise not to touch.
   * Both cannot be true, and the one people rely on for their own safety is
   * the one that had to become precise.
   *
   * Rewritten again when the map picker arrived. The old sentence promised
   * "no coordinate ever reaches our database", which a photographer marking
   * a spot makes false — so it now promises the thing that is still true and
   * is the thing people actually rely on: nothing is taken from the file.
   * Anything stored is something they chose to put there, and they can take
   * it back out.
   */
  {
    title: "Nothing is taken from your file",
    detail:
      "The GPS block in your file is never read, so where you were is never taken from it. What the gallery publishes is a fresh copy carrying no metadata at all — downloading it tells nobody anything. If you want to say where you stood you can write it down or mark it on a map, and you can clear it again; camera and exposure are kept, because those are about the photograph rather than about you.",
  },
  {
    title: "You keep control",
    detail:
      "Publish directly, with no approval queue. Edit, unpublish or delete your own photographs at any time. Your original is kept exactly as you sent it — untouched, never re-encoded, and never linked from the site.",
  },
];

export function WhatYouGet() {
  return (
    <section className="mb-10">
      {/*
        `/membership` sets a section called "What you get" with
        `SECTION_HEADING`; this one set the same words at 11px uppercase,
        which is the exact bug that token's docblock says it exists to fix —
        a heading introducing four paragraphs, rendered as a caption. One
        page, two answers to the same question, is how the wall of flat
        sections happened.
      */}
      <h2 className={SECTION_HEADING}>What you get</h2>

      <ul className="mt-4 grid gap-px overflow-hidden rounded-2xl bg-white/[0.06] sm:grid-cols-2">
        {OFFERS.map((offer) => (
          <li className="bg-surface p-4 sm:p-5" key={offer.title}>
            <h3 className={ITEM_HEADING}>{offer.title}</h3>
            <p className={`mt-1.5 text-pretty ${BODY_SMALL}`}>{offer.detail}</p>
          </li>
        ))}
      </ul>

      {/*
        A worked example beats the description. Someone deciding whether to
        send their photographs wants to see the page they would get, not read
        about it.
      */}
      <p className="mt-4 text-[0.8125rem] text-white/55">
        See one:{" "}
        <TextLink href="/photographers">
          the photographers already here
        </TextLink>
        .
      </p>
    </section>
  );
}
