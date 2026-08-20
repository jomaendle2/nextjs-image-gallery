import type { ReactNode } from "react";
import {
  BODY,
  BODY_SMALL,
  ITEM_HEADING,
  SECTION_HEADING,
  WORKSPACE_CARD,
} from "@/components/ui/field";

/**
 * One numbered step.
 *
 * The number is a real `<ol>` item rather than a drawn circle with a digit in
 * it, so the order is in the markup as well as in the design — and the digit is
 * `aria-hidden` because a list already announces its own position, and hearing
 * "1. 1. Add the photographs" is worse than hearing neither.
 */
function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3.5">
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-white/10 font-medium text-[0.75rem] text-white/70 tabular-nums"
      >
        {n}
      </span>
      <div className="min-w-0">
        <p className={ITEM_HEADING}>{title}</p>
        <p className={`mt-1 ${BODY_SMALL}`}>{children}</p>
      </div>
    </li>
  );
}

/**
 * What this page is, said before anybody has used it.
 *
 * The zero state used to be one line — "Nothing here yet. Upload your first
 * photograph above." — and every word of explanation lived inside
 * `PhotoEditForm`, which does not render until a photograph exists. So the
 * first thing a new photographer met was a file input and no account of what
 * pressing anything would do: whether an upload goes live immediately, whether
 * somebody vets it, what the "Members only" fieldset is for, or why a title is
 * refused as optional. All of that was written down. None of it was reachable
 * from the one screen where it was still a question.
 *
 * The load-bearing sentence is the first one. Nobody reviews any of this —
 * there is no queue, no approval, no moderator. That is the most reassuring
 * fact about the whole flow and it was stated nowhere, which leaves somebody
 * uploading for the first time to guess, and the cautious guess is to wait for
 * a reply that is never coming.
 *
 * It goes away once something is published rather than once something is
 * uploaded: the thing being explained is the round trip, and somebody with ten
 * drafts and no published photograph has not finished it yet.
 */
/*
 * This used to take `membershipOffered` and end with a paragraph about the
 * "Members only" block. Gone entirely, and not only for length: memberships
 * are deliberately kept quiet until there are contributors and readers to
 * offer them to, and the zero state is the loudest possible place to
 * advertise a tier nobody can buy. The member fields still explain
 * themselves where they are filled in, which is the project's own rule
 * about where such statements belong.
 */
export function FirstRun({ invitedBy }: { invitedBy: string | null }) {
  return (
    <section className={WORKSPACE_CARD}>
      {/*
        Who brought them here, when a photographer rather than the owner did.

        An invitation from a peer is the one arrival on this site that
        somebody chose personally, and the workspace greeted everybody
        identically — so the warmest fact about a new photographer's first
        screen was one the site knew and did not say. Absent for anybody the
        owner brought in, by either door, because "the gallery invited you" is
        not news — `inviterName` filters on the inviter's role for that.
      */}
      {invitedBy === null ? null : (
        <p className={`mb-4 ${BODY_SMALL}`}>{invitedBy} invited you here.</p>
      )}

      <h2 className={SECTION_HEADING}>Nobody reviews any of this</h2>
      <p className={`mt-2 ${BODY}`}>
        You publish your own photographs. Pressing Publish puts one on the site
        straight away, and Unpublish takes it off again just as quickly. Nothing
        waits in a queue and nobody is looking at it before you are.
      </p>

      <ol className="mt-5 space-y-4">
        <Step n={1} title="Add the photographs">
          Drag them into the box below, or choose them. Each one arrives as a
          draft: it is listed here and nowhere else on the site.
        </Step>
        <Step n={2} title="Give each one a title and a description">
          Both are required. The description matters most: it is what a screen
          reader says in place of the photograph. “Suggest details” drafts both
          for you — edit anything, nothing is saved until you save.
        </Step>
        <Step n={3} title="Publish it">
          The photograph joins the gallery, your own page, the feed, the globe,
          and the queue for the next message to the mailing list. You can
          unpublish it, edit it and publish it again as often as you like.
        </Step>
      </ol>
    </section>
  );
}
