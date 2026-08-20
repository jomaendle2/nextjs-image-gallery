import {
  BODY,
  ITEM_HEADING,
  SECTION_HEADING,
  WORKSPACE_CARD,
} from "@/components/ui/field";
import { ShareButton } from "@/components/ui/ShareButton";
import { TextLink } from "@/components/ui/TextLink";
import { count } from "@/lib/plural";

/**
 * The moment after the first photograph goes live.
 *
 * Publishing into a gallery you were invited to is the whole point of this
 * software, and the app's entire response to it was the word "Published."
 * beside a form. The photographer's page went from an address that existed to
 * an address worth sending somebody, and nothing said so — so the two things a
 * person actually wants at that moment, to look at it and to show it to
 * someone, were both several clicks away and neither was suggested.
 *
 * **It appears at exactly one published photograph and leaves at the second.**
 * A moment rather than furniture. The condition is a count the page already
 * has, so it needs no state of its own — nothing to store, expire or dismiss
 * — and the honest consequence of that is that it is a property of the count
 * and not a record of an event: somebody who unpublishes back down to one
 * sees it again. That is the trade being made, and it is the right way round,
 * because the alternative is a row in the database to suppress a card.
 *
 * The invitation is the second half and deliberately *below* the first. The
 * gallery has no open sign-up, so invitations are the only way anybody new
 * arrives, and the moment somebody is proudest of their own page is the
 * moment that fact is worth stating. But it is an aside, not the ask: the
 * heading is about their photograph, and a card that celebrated somebody's
 * first publication by immediately requesting recruitment would read as a
 * growth loop wearing a compliment.
 */
export function JustLive({ slug, invites }: { slug: string; invites: number }) {
  return (
    <section className={WORKSPACE_CARD}>
      <h2 className={SECTION_HEADING}>Your first photograph is live</h2>
      <p className={`mt-2 max-w-prose text-pretty ${BODY}`}>
        It is on the gallery, on your own page, and in the feed — and it went
        there the moment you pressed publish, without passing anybody.
      </p>

      {/*
        `gap-x-8` rather than the `gap-x-6` used where these sit under a
        photograph. Both controls pull themselves outward to reach 44px —
        `TOUCH_LINK` by `-mx-2` and `ShareButton` by `-mx-4` — which eats 24 of
        the 24 pixels between them and leaves the two targets flush against
        each other.
      */}
      <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-3">
        <TextLink href={`/by/${slug}`} standalone={true}>
          See your page
        </TextLink>
        {/*
          The share affordance belongs here rather than only on the public
          page. This is the URL a photographer would actually send about their
          own work, and until now the one place they were certain to be
          standing — just after publishing — offered no way to copy it.
        */}
        <ShareButton
          className="text-white/55 hover:text-white"
          label="your page"
          path={`/by/${slug}`}
          title="My photographs on the beauty of earth"
          withLabel={true}
        />
      </div>

      {invites > 0 ? (
        <div className="mt-6 border-white/[0.08] border-t pt-5">
          <p className={ITEM_HEADING}>
            You have {count(invites, "invitation")} to give
          </p>
          <p className={`mt-1 max-w-prose text-pretty ${BODY}`}>
            There is no open sign-up — invitations are the only way anybody new
            arrives here. Spend them on people whose work you would want beside
            your own.{" "}
            <TextLink href="/contribute/invite">Invite a photographer</TextLink>
            .
          </p>
        </div>
      ) : null}
    </section>
  );
}
