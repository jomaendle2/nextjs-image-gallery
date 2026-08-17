import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { TOUCH_LINK } from "./field";

/**
 * The way out, spelled one way.
 *
 * There were four of these, and they disagreed about everything a link can
 * disagree about. `/globe` and `/photographers` were byte-identical and
 * right. The photographer header hand-rolled half of `TOUCH_LINK` — the
 * vertical pair without the horizontal one — so the wordmark cleared 44px
 * downwards and measured about 120px × 44px only because the words happened
 * to be long; the rule it broke is the one DESIGN.md records by name.
 * `ContributeShell` set it a size larger, a shade fainter, at a different
 * tracking, with a different hover, **and no arrow at all** — so half the
 * site offered "← the beauty of earth." and the other half a bare wordmark
 * that reads as a title rather than a way back.
 *
 * White, never accent, because this renders inside `src/components/gallery`
 * as well as on the reading pages: in the viewer the photograph is the only
 * thing allowed a colour, and a token that carries one across that boundary
 * is precisely what `design.test.ts` rule 4 is watching for.
 *
 * The arrow is `aria-hidden`: it is punctuation for the eye, and the words
 * beside it already say where the link goes.
 */
export function WordmarkLink({ className = "" }: { className?: string }) {
  return (
    <Link
      className={`${TOUCH_LINK} gap-1.5 rounded-full font-semibold text-[0.8125rem] text-white/55 tracking-[-0.02em] transition-colors hover:text-white/80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80 ${className}`}
      href="/"
    >
      <ArrowLeft aria-hidden="true" size={13} />
      the beauty of earth.
    </Link>
  );
}
