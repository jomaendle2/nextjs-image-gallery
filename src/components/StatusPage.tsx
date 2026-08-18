import type { ReactNode } from "react";
import { BODY_SMALL, PAGE_TITLE } from "@/components/ui/field";
import { TextLink } from "@/components/ui/TextLink";
import { GROUND } from "@/lib/photo-ground";

interface StatusPageProps {
  /** The short, human line. Not a status code. */
  title: string;
  /** One sentence on what happened and what the reader can do. */
  detail: string;
  /** An optional action beside the way home — a retry, usually. */
  action?: ReactNode;
}

/**
 * The page we show when there is no photograph to show.
 *
 * Deliberately the same near-black ground and the same wordmark as every
 * other page: a 404 that looks like a different site reads as broken twice
 * over. There is no illustration and no apology, only the way back — the
 * gallery is one click away from everywhere, so a dead end should be too.
 */
export function StatusPage({ title, detail, action }: StatusPageProps) {
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

        <h1 className={`mt-6 text-balance ${PAGE_TITLE}`}>{title}</h1>
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
