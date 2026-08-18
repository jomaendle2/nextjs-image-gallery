"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

/**
 * One short line, with the full explanation a click away.
 *
 * The edit form carried about a hundred and ninety words of helper prose
 * against seven inputs, every word of it always on screen and set at the same
 * weight as the labels. Each paragraph earned its place when it was written —
 * they are the consent and the privacy statements, said at the moment the
 * decision is made, which is the only place they are worth anything — but
 * together they turned a form into a document with inputs in it.
 *
 * So nothing is deleted and nothing is moved to another page. The claim
 * itself stays visible, cut to the one sentence somebody needs to decide;
 * the reasoning behind it, which is what somebody reads once and never again,
 * folds. A photographer captioning their fortieth photograph sees a form, and
 * the person reading this for the first time is one click from all of it.
 *
 * `<details>` rather than a hover card or a tooltip: it works on a phone, it
 * is keyboard operable with no handlers of ours, its open state is announced,
 * and the browser's own in-page search finds the text inside it while it is
 * closed. A tooltip has none of those properties and this text is a privacy
 * statement.
 */
export function Why({
  /** The part that stays on screen. One sentence, and it must stand alone. */
  summary,
  children,
}: {
  summary: string;
  children: ReactNode;
}) {
  return (
    <details className="group">
      {/*
        `list-none` plus an explicit chevron, matching the row disclosure: the
        native triangle differs on every platform and none of them match this.

        The negative margins are the `TOUCH_LINK` trick, and they are here for
        the same reason DESIGN.md gives — the padding grows the target to the
        44px floor and is then pulled straight back out, so a line of helper
        text stays a line of helper text rather than becoming a 44px band. On
        both axes, because a 44px floor on one axis is not a 44px target.
      */}
      <summary className="-mx-2 -my-2.5 inline-flex min-h-11 min-w-11 cursor-pointer list-none items-center gap-1.5 rounded-lg px-2 py-2.5 text-[0.75rem] text-white/55 leading-relaxed transition-colors hover:text-white/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 [&::-webkit-details-marker]:hidden">
        <span>{summary}</span>
        {/*
          "Why" is the word rather than a bare chevron. A chevron alone is a
          shape somebody has to try in order to learn what it does, and this
          one opens a privacy statement — the least good place on the site to
          make anybody guess.
        */}
        <span className="shrink-0 underline underline-offset-2">Why</span>
        <ChevronDown
          aria-hidden="true"
          className="shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
          size={13}
        />
      </summary>

      <p className="mt-2 border-white/10 border-l-2 pl-3 text-[0.75rem] text-white/55 leading-relaxed">
        {children}
      </p>
    </details>
  );
}
