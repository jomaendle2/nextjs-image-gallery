import Link from "next/link";
import type { ReactNode } from "react";
import { TOUCH_LINK } from "@/components/ui/field";
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
        <p className="font-semibold text-[0.8125rem] text-white/45 tracking-[-0.02em]">
          the beauty of earth.
        </p>

        <h1 className="mt-6 text-balance font-semibold text-2xl tracking-[-0.035em] sm:text-3xl">
          {title}
        </h1>
        <p className="mt-3 text-pretty text-sm text-white/50 leading-relaxed">
          {detail}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-1">
          <Link
            className={`${TOUCH_LINK} font-medium text-sm text-white/70 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white hover:decoration-white/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80`}
            href="/"
          >
            Back to the gallery
          </Link>
          {action}
        </div>
      </div>
    </main>
  );
}
