import { Check, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { BODY_SMALL, PAGE_TITLE } from "@/components/ui/field";
import { TextLink } from "@/components/ui/TextLink";
import { GROUND } from "@/lib/photo-ground";

/**
 * Whether something happened, or whether there was nothing to do.
 *
 * The five pages using this component were indistinguishable from each other
 * and from a 404: "you are now following", "your address is deleted", "that
 * link matched nobody" and "this page does not exist" were the same centred
 * paragraph in the same grey. Every one of them is the end of a journey that
 * started in an inbox, and none of them said, at a glance, which kind of end
 * it was.
 *
 * Two states rather than five, because there are only two answers a reader
 * needs: the thing you asked for happened, or there was nothing here to do.
 * `Notice` owns the same distinction for messages inside a page; this is its
 * whole-page equivalent, and it borrows the accent for the same reason —
 * DESIGN.md allows it on the one thing a view is about, and on these pages
 * the outcome *is* the view.
 *
 * Undefined for a genuine error page. A 404 is neither an accomplishment nor
 * a dead end somebody chose, and marking it as either would be the kind of
 * colour that means nothing.
 */
export type StatusTone = "done" | "nothing-to-do";

interface StatusPageProps {
  /** The short, human line. Not a status code. */
  title: string;
  /** One sentence on what happened and what the reader can do. */
  detail: string;
  /** An optional action beside the way home — a retry, usually. */
  action?: ReactNode;
  /** Which kind of ending this is. Omitted on error pages; see `StatusTone`. */
  tone?: StatusTone;
}

/**
 * The page we show when there is no photograph to show.
 *
 * Deliberately the same near-black ground and the same wordmark as every
 * other page: a 404 that looks like a different site reads as broken twice
 * over. There is no illustration and no apology, only the way back — the
 * gallery is one click away from everywhere, so a dead end should be too.
 */
export function StatusPage({ title, detail, action, tone }: StatusPageProps) {
  return (
    <main
      className="grid min-h-dvh place-items-center px-6 text-white"
      style={{ backgroundColor: GROUND }}
    >
      <div className="w-full max-w-sm text-center">
        {/*
          A label, not `WordmarkLink`: the way home is already the link below
          it, and two anchors to `/` on a page this small is one of them
          nobody needs. It keeps the wordmark's own setting for the same
          reason the photographer header does.
        */}
        <p className="font-semibold text-[0.8125rem] text-white/55 tracking-[-0.02em]">
          the beauty of earth.
        </p>

        {/*
          One mark, and it carries the only colour on the page.

          A tick in the accent for something that happened, a dash in plain
          white for a link that matched nothing — the second is deliberately
          not red, because arriving at "there was nothing to stop" is not an
          error and should not be dressed as one. The `sr-only` word is what
          makes this a message rather than a decoration: colour alone is not
          one, which is the rule `Notice` already follows.
        */}
        {tone === undefined ? null : (
          <p
            className={`mx-auto mt-6 flex size-11 items-center justify-center rounded-full ${
              tone === "done"
                ? "bg-accent-fill text-accent"
                : "bg-white/[0.06] text-white/55"
            }`}
          >
            <span className="sr-only">
              {tone === "done" ? "Done." : "Nothing to do."}
            </span>
            {tone === "done" ? (
              <Check aria-hidden="true" size={20} strokeWidth={2.5} />
            ) : (
              <Minus aria-hidden="true" size={20} strokeWidth={2.5} />
            )}
          </p>
        )}

        <h1
          className={`text-balance ${PAGE_TITLE} ${tone === undefined ? "mt-6" : "mt-5"}`}
        >
          {title}
        </h1>
        <p className={`mt-3 text-pretty ${BODY_SMALL}`}>{detail}</p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-1">
          {/*
            `TextLink`, not the fifth spelling of a link this used to be —
            white/70 with a quarter-opacity underline, invented here and
            nowhere else. A 404 is a reading page, and on a reading page a
            link is accent and comes from one component.
          */}
          <TextLink href="/" standalone={true}>
            Back to the gallery
          </TextLink>
          {action}
        </div>
      </div>
    </main>
  );
}
