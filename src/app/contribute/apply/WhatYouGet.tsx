import Link from "next/link";

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
    title: "Credit that travels with the work",
    detail:
      "Your name sits on every photograph wherever it appears, linking out to your own site. Nothing here is published anonymously.",
  },
  {
    title: "Your coordinates never leave your camera",
    detail:
      "GPS is stripped from every upload — not filtered, never read. Camera and exposure details are kept; where you were standing is nobody's business but yours.",
  },
  {
    title: "You keep control",
    detail:
      "Publish directly, with no approval queue. Edit, unpublish or delete your own photographs at any time. Your original file is stored exactly as you sent it, never re-encoded.",
  },
];

export function WhatYouGet() {
  return (
    <section className="mb-10">
      <h2 className="font-medium text-[0.6875rem] text-white/40 uppercase tracking-[0.14em]">
        What you get
      </h2>

      <ul className="mt-4 grid gap-px overflow-hidden rounded-2xl bg-white/[0.06] sm:grid-cols-2">
        {OFFERS.map((offer) => (
          <li className="bg-surface p-4 sm:p-5" key={offer.title}>
            <h3 className="font-semibold text-[0.9375rem] text-white tracking-[-0.02em]">
              {offer.title}
            </h3>
            <p className="mt-1.5 text-pretty text-[0.8125rem] text-white/50 leading-relaxed">
              {offer.detail}
            </p>
          </li>
        ))}
      </ul>

      {/*
        A worked example beats the description. Someone deciding whether to
        send their photographs wants to see the page they would get, not read
        about it.
      */}
      <p className="mt-4 text-[0.8125rem] text-white/45">
        See one:{" "}
        <Link
          className="text-white/70 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white hover:decoration-white/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80"
          href="/photographers"
        >
          the photographers already here
        </Link>
        .
      </p>
    </section>
  );
}
