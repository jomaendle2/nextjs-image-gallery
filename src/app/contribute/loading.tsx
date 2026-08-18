import { SiteFooter } from "@/components/SiteFooter";
import { EnvironmentBanner } from "@/components/ui/EnvironmentBanner";
import { PAGE_TITLE } from "@/components/ui/field";
import { WordmarkLink } from "@/components/ui/WordmarkLink";

/**
 * What every /contribute page shows while its data is still in flight.
 *
 * There was no loading boundary anywhere in the app, which is a worse problem
 * than it sounds. `/contribute/photos` reads `cookies()`, so it is dynamic and
 * cannot be prerendered: without a boundary the browser sits on the *previous*
 * page for the whole server render, showing nothing, and a navigation that
 * measures 117ms at the median and 593ms at p90 reads as a dead click.
 *
 * The second effect is the one that matters more. A dynamic route with no
 * loading boundary gives `<Link>` prefetch nothing it can keep — the dev trace
 * recorded 970 `?_rsc=` renders of this route whose work was thrown away,
 * because there was no static shell to cache. This file *is* that shell, so
 * prefetch starts paying for itself and the header paints on click.
 *
 * It deliberately mirrors `ContributeShell`'s `Frame` rather than being a
 * generic spinner: same ground, same gradient, same wordmark in the same
 * place, same heading metrics. The parts that are real — the chrome — are
 * drawn for real, and only the parts we cannot know yet are bars. Nothing
 * moves when the page arrives.
 */
export default function Loading() {
  return (
    <div className="min-h-dvh bg-surface text-white">
      {/*
        `Frame` renders this above everything else. Leaving it out made the
        whole page jump down by the banner's height the moment data landed —
        in a file whose entire claim is that nothing moves when it does.
      */}
      <EnvironmentBanner />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(120% 70% at 50% 0%, oklch(100% 0 0 / 0.07), transparent 60%)",
        }}
      />
      {/*
        `ContributeShell`'s measure, not `ContributeWorkspace`'s.

        This one file is the boundary for every route under `/contribute`, and
        they do not agree on a width: `/photos` is the wide workspace, and
        `/invite` and `/admin` are this narrower reading measure. Taking the
        wide one meant the skeleton was nearly twice the width of the page
        that replaced it on two of the three. Starting narrow is the safer
        mismatch — growing into place reads as loading, shrinking reads as a
        mistake.
      */}
      <div className="relative mx-auto w-full max-w-3xl px-6 py-12 sm:py-16">
        {/*
          One announcement for the whole page, rather than a bar each. A
          screen reader should hear "Loading" once and then the finished page;
          `aria-busy` on a tree of decorative divs would say it six times.
        */}
        <output aria-live="polite" className="sr-only">
          Loading.
        </output>

        <header className="mb-10">
          {/*
            The wordmark is real and clickable even here. A slow page is
            exactly when somebody wants the way out, and a skeleton that grays
            out the only exit is worse than no skeleton.
          */}
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-baseline gap-x-2 text-sm"
          >
            <WordmarkLink />
          </nav>

          {/*
            `PAGE_TITLE` on an empty element rather than a fixed height, so
            the bar is exactly as tall as the heading that replaces it and the
            swap costs no layout shift.
          */}
          <div className={`mt-2 ${PAGE_TITLE}`} aria-hidden="true">
            <div className="h-[1em] w-56 max-w-full animate-pulse rounded-md bg-white/10 motion-reduce:animate-none" />
          </div>
          <div
            aria-hidden="true"
            className="mt-3 h-4 w-72 max-w-full animate-pulse rounded-md bg-white/[0.06] motion-reduce:animate-none"
          />
        </header>

        <main>
          <div
            aria-hidden="true"
            className="space-y-3 motion-reduce:animate-none"
          >
            {/*
              Three bars, not a count that pretends to know the answer. The
              dashboard may hold two photographs or two hundred; a skeleton
              that guesses wrong shifts the page twice instead of once.
            */}
            {[0, 1, 2].map((row) => (
              <div
                className="h-16 animate-pulse rounded-2xl bg-white/[0.04] motion-reduce:animate-none"
                key={row}
                style={{ animationDelay: `${row * 90}ms` }}
              />
            ))}
          </div>
        </main>

        <SiteFooter className="mt-16" />
      </div>
    </div>
  );
}
