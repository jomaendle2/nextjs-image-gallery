import type { Metadata } from "next";
import Link from "next/link";
import { GlobeStage } from "@/components/geo/GlobeStage";
import { SiteFooter } from "@/components/SiteFooter";
import {
  BODY,
  LINK,
  META,
  PAGE_TITLE,
  SECTION_HEADING,
} from "@/components/ui/field";
import { SiteNav } from "@/components/ui/SiteNav";
import { TextLink } from "@/components/ui/TextLink";
import { WordmarkLink } from "@/components/ui/WordmarkLink";
import { membershipConfigured } from "@/lib/members/offer";
import { alternates } from "@/lib/metadata";
import { GROUND } from "@/lib/photo-ground";
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
          {/*
            The wordmark says whose site this is; the nav says which of its
            rooms you are standing in. Before both were here, a visitor who
            arrived on this page from a shared link could only go home.
          */}
          <div className="flex flex-wrap items-center justify-between gap-x-4">
            <WordmarkLink />
            <SiteNav
              current="globe"
              membershipOffered={membershipConfigured()}
            />
          </div>

          <h1 className={`mt-1.5 ${PAGE_TITLE}`}>Where these were taken</h1>
          <p className={`mt-1 ${META}`}>
            {`${count(cells.length, "place")} · ${count(photographs, "photograph")}`}
          </p>
        </header>

        <main className="mt-10">
          {cells.length === 0 ? (
            <p className={`max-w-prose text-pretty ${BODY}`}>
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
                The globe alone, centred. A paragraph used to sit beside it
                explaining what the marks do and do not mean; the first test
                user read it as defensive noise, and the substance — marked by
                photographers, deliberately approximate — already lives in
                /privacy for anybody who wonders. The heading, the count and
                the place list below say everything a visitor needs.

                Everything the globe shows is below in a form that works with
                no JavaScript, no canvas and no sight — which is why nothing
                on this page waits for it, and why the only thing about it
                that has to be reachable from a keyboard is the button that
                opens it.
              */}
              <div className="mx-auto w-full max-w-[26rem]">
                <GlobeStage points={toGlobePoints(cells)} />
              </div>

              <ul className="mt-14 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
                {cells.map((cell) => (
                  <li key={cell.key}>
                    {/*
                      `SECTION_HEADING`, even though there are forty of these
                      rather than three.

                      The argument for keeping it its own size was that a
                      place name in a grid cell is a label, not a page
                      section. But the token's own docblock draws that line
                      somewhere else, and draws it well: a label captions a
                      number or a field, and a heading introduces something.
                      Each of these introduces a list of photographs, and it
                      is the only `h2` on the page. A sixth size to say
                      "heading, but in a column" is how five of them got here.
                    */}
                    <h2 className={SECTION_HEADING}>{labelFor(cell)}</h2>
                    <p className={`mt-1 ${META}`}>
                      {count(cell.photos.length, "photograph")}
                    </p>
                    <ul className="mt-2.5 space-y-1">
                      {cell.photos.map((photo) => (
                        <li key={photo.id}>
                          {/*
                            `standalone`, because tapping one of these is the
                            entire purpose of the page. Raw `LINK` left them
                            18px tall in a list with 4px between them — the
                            exact mistake DESIGN.md records by name. The
                            negative margin in `TOUCH_LINK` pulls the padding
                            straight back out, so the rhythm is unchanged.
                          */}
                          <TextLink
                            href={`/photo/${photo.id}`}
                            standalone={true}
                          >
                            {photoTitle(photo.title)}
                          </TextLink>
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
