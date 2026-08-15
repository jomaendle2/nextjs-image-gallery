import { photoGlow } from "@/lib/photo-ground";

/**
 * The three decorative layers behind the photograph.
 *
 * These are pure decoration — no state, no events, nothing the carousel's
 * orchestration needs to reach into — but inline they took up a third of
 * `ImageCarousel`'s render body and made it read as a layout component when
 * it is really a state machine over an index. Out here the gradients can be
 * read, and tuned, as one thing.
 *
 * Two washes give ambient depth: a soft light from above carrying the
 * photograph's own colour, and a heavier fall-off at the base. The second is
 * neutral rather than tinted so it works for every colour in the set without
 * a per-image gradient. The two scrims exist for legibility rather than
 * depth: white chrome sits at the top and bottom edges and has to stay
 * readable over a pale photograph.
 */
export function AmbientBackdrop({ bgColor }: { bgColor: string }) {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background: `radial-gradient(120% 80% at 50% 12%, ${photoGlow(bgColor)}, transparent 62%), radial-gradient(100% 90% at 50% 118%, oklch(0% 0 0 / 0.45), transparent 62%)`,
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-40 scrim-top"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-64 scrim-bottom"
      />
    </>
  );
}
