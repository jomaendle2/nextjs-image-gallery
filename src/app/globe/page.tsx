import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { GlobeStage } from "@/components/geo/GlobeStage";
import { SiteFooter } from "@/components/SiteFooter";
import { LINK, META, TOUCH_LINK } from "@/components/ui/field";
import { alternates } from "@/lib/metadata";
import { GROUND } from "@/lib/photo-ground";
import { CELL_KM } from "@/lib/photos/coarsen";
import { groupIntoCells, labelFor, toGlobePoints } from "@/lib/photos/globe";
import { listGlobePoints } from "@/lib/photos/repository";
import { photoTitle } from "@/lib/photos/title";
import { count } from "@/lib/plural";

export const revalidate = 3600;

export const metadata: Metadata = {
  alternates: alternates("/globe"),
  title: "Where these were taken — the beauty of earth.",
  description:
    "Every place a photographer has marked, blurred to about a hundred kilometres.",
};

/**
 * The gallery by place.
 *
 * A server component with the same hourly revalidation as every other public
 * page, rather than a route handler with something fetching it — the data is
 * a list of places and the page is a list of places, and putting an API
 * between them would buy a spinner.
 *
 * **Degrading without JavaScript is the design, not a fallback.** What this
 * renders is a grouped list of real `<a href>`s, complete: every published
 * photograph with a marked point is reachable from it. A crawler gets the
 * whole gallery organised by geography, a screen reader gets a nested list
 * in a sensible order, and a canvas globe mounts alongside for people who
 * can see one. That ordering is deliberate — a globe is the thing worth
 * showing somebody, and a page that is *only* a globe is a page that shows
 * nothing to half the things that visit it.
 *
 * **No thumbnails.** At three hundred photographs that would reproduce the
 * 5.4 KB-per-photograph problem `docs/next-version.md` §2 already tracks,
 * and the instinct to add them is the obvious next idea somebody will have.
 * The doc says so too.
 */
export default async function GlobePage() {
  const cells = groupIntoCells(await listGlobePoints());
  const photographs = cells.reduce(
    (total, cell) => total + cell.photos.length,
    0,
  );

  return (
    <div
      className="relative min-h-dvh text-white"
      style={{ backgroundColor: GROUND }}
    >
      <div className="mx-auto w-full max-w-[1536px] px-4 py-10 sm:px-8 sm:py-14">
        <header>
          <Link
            className={`${TOUCH_LINK} gap-1.5 font-semibold text-[0.8125rem] text-white/55 tracking-[-0.02em] transition-colors hover:text-white/80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80`}
            href="/"
          >
            <ArrowLeft aria-hidden="true" size={13} />
            the beauty of earth.
          </Link>

          <h1 className="mt-1.5 font-semibold text-2xl tracking-[-0.035em] sm:text-3xl">
            Where these were taken
          </h1>
          <p className={`mt-1 ${META}`}>
            {`${count(cells.length, "place")} · ${count(photographs, "photograph")}`}
          </p>
        </header>

        <main className="mt-10">
          {cells.length === 0 ? (
            <p className="max-w-prose text-pretty text-[0.9375rem] text-white/60 leading-relaxed">
              No photographer has marked a place yet. When one does, it will
              appear here.{" "}
              <Link className={LINK} href="/">
                Back to the gallery
              </Link>
              .
            </p>
          ) : (
            <>
              {/*
                Text and globe as one band, rather than a centred sphere with
                empty columns either side of it.

                A globe alone in the middle of a page is a decoration looking
                for a caption. Set beside the sentence that qualifies it, the
                two read as one statement: here is the world, and here is what
                these marks do and do not mean.
              */}
              <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16">
                <p className="max-w-prose text-pretty text-[1.0625rem] text-white/65 leading-relaxed">
                  Photographers mark these themselves; nothing is ever read from
                  a photograph's file. Each place is deliberately blunt: the
                  middle of a square about {CELL_KM} kilometres across, so it
                  says roughly where somebody was and not where they stood.
                </p>

                {/*
                  Beside the list, never instead of it. Everything the globe
                  shows is below in a form that works with no JavaScript, no
                  canvas and no sight — which is why nothing on this page
                  waits for it, and why the only thing about it that has to be
                  reachable from a keyboard is the button that opens it.
                */}
                <div className="mx-auto w-full max-w-[26rem]">
                  <GlobeStage points={toGlobePoints(cells)} />
                </div>
              </div>

              <ul className="mt-14 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
                {cells.map((cell) => (
                  <li key={cell.key}>
                    <h2 className="font-semibold text-[1.0625rem] text-white tracking-[-0.025em]">
                      {labelFor(cell)}
                    </h2>
                    <p className={`mt-1 ${META}`}>
                      {count(cell.photos.length, "photograph")}
                    </p>
                    <ul className="mt-2.5 space-y-1">
                      {cell.photos.map((photo) => (
                        <li key={photo.id}>
                          <Link
                            className={`${LINK} text-[0.9375rem]`}
                            href={`/photo/${photo.id}`}
                          >
                            {photoTitle(photo.title)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </>
          )}
        </main>

        <SiteFooter className="mt-16" />
      </div>
    </div>
  );
}
