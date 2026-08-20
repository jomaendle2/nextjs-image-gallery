import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GlassButton } from "@/components/ui/glass-button";
import { TextLink } from "@/components/ui/TextLink";
import { aiSuggestionsConfigured } from "@/lib/ai/offer";
import { inviterName, invitesRemaining } from "@/lib/auth/contributors";
import { getCurrentContributor } from "@/lib/auth/session";
import { isOwner } from "@/lib/auth/types";
import { mapStyleUrl } from "@/lib/maptiler";
import { listOwnPhotos } from "@/lib/photos/repository";
import { count } from "@/lib/plural";
import { signOut } from "../actions";
import { ContributeWorkspace } from "../ContributeShell";
import { WorkspaceNav } from "../WorkspaceNav";
import { FirstRun } from "./FirstRun";
import { JustLive } from "./JustLive";
import { PhotoList } from "./PhotoList";
import { UnsavedGuard } from "./UnsavedGuard";
import { UploadForm } from "./UploadForm";

export const metadata: Metadata = {
  title: "Your photographs — the beauty of earth.",
  robots: { index: false },
};

export default async function PhotosPage() {
  const contributor = await getCurrentContributor();
  if (!contributor) {
    /*
     * `error=ended` rather than a bare redirect, matching the other two
     * contributor pages. A session that ran out used to turn the page a
     * photographer was working on into a sign-in form with no explanation,
     * which from the outside is indistinguishable from the site having
     * forgotten them.
     */
    redirect("/contribute?error=ended");
  }

  /*
   * `inviterName` is fetched here, beside the other two, and not inside an
   * `async FirstRun` that needs it — even though only the zero state reads
   * it. `src/components/**` contains no async components at all: every page
   * in this app fetches and passes props, and making the exception here would
   * be the first instance of a second pattern for the sake of one indexed
   * single-row lookup that runs in parallel with two queries already in
   * flight. The alternative also serialises the zero state behind it.
   */
  const [photos, invites, invitedBy] = await Promise.all([
    listOwnPhotos(contributor.id),
    invitesRemaining(contributor.id),
    inviterName(contributor.id),
  ]);
  const published = photos.filter((photo) => photo.published_at !== null);

  return (
    <ContributeWorkspace
      nav={<WorkspaceNav current="photographs" owner={isOwner(contributor)} />}
      action={
        <form action={signOut}>
          <GlassButton size="sm" type="submit">
            Sign out
          </GlassButton>
        </form>
      }
      subtitle={`Signed in as ${contributor.display_name}.`}
      title="Your photographs"
    >
      {/*
        One either/or, because these are the two ends of the same round trip.

        `=== 1` rather than `> 0`: this is the moment the page went from an
        address that existed to one worth sending somebody, and the second
        publish takes it away again. The card is not shown *beside* the link
        row, it replaces it — the card says both of those things better, since
        it links to the page and explains what the invitations are for. Two
        links to `/by/<slug>` a hand's width apart, and the same count stated
        twice, is what "celebrate the moment" looks like when it is bolted on
        beside the furniture instead of replacing it.

        The predicate was written twice in opposite polarity, thirty-eight
        lines apart, with the reason only at the first of them. Widen one and
        miss the other and the result is exactly the doubled-link layout the
        reason exists to prevent, so there is one of it — pinned by
        `src/lib/workspace.test.ts`. At zero the else branch collapses to the
        invitations line alone, which is what it rendered before.
      */}
      {published.length === 1 ? (
        <JustLive invites={invites} slug={contributor.slug} />
      ) : (
        <div className="mb-8 flex flex-wrap gap-3">
          {published.length > 0 ? (
            <TextLink href={`/by/${contributor.slug}`} standalone={true}>
              View your public page
            </TextLink>
          ) : null}
          {/*
          `invite` and `contributors` used to be here too, and are now in
          `WorkspaceNav` above — a row of links that only existed on the
          dashboard is not navigation, it is a dead end everywhere else.

          The count stays behind, because it is news rather than a
          destination, and it is hidden once spent rather than shown as a dead
          "0 left": somebody who has three is being told they can bring people
          in, and somebody who has none has nothing to act on.
        */}
          {invites > 0 ? (
            <p className="text-sm text-white/55">
              {count(invites, "invitation")} left to give.
            </p>
          ) : null}
        </div>
      )}

      {/*
        Before the upload box rather than after it, and only until the first
        photograph is live. It answers the questions somebody has while looking
        at the file input, and the most important of them — that nobody reviews
        any of this — was answered nowhere on the site.
      */}
      {published.length === 0 ? <FirstRun invitedBy={invitedBy} /> : null}

      {/*
        The tile key is read here, on the server, and handed down as a prop.
        `NEXT_PUBLIC_MAPTILER_KEY` would have been one word shorter and would
        have compiled the key into every client bundle on the site, including
        the ones anonymous visitors receive.

        `aiSuggestionsConfigured()` is read the same way and for a stronger
        version of the same reason: a gateway key is a spending credential, so
        the question "is this switched on" is answered on the server and the
        answer — a boolean — is what crosses to the browser.

        The upload box goes in as a slot rather than as a sibling above,
        because from `xl` up it belongs in the rail beside the list. It is
        still rendered by this page, so a batch in flight is not at the mercy
        of the list re-rendering around it.
      */}
      <UnsavedGuard />

      <PhotoList
        aiOffered={aiSuggestionsConfigured()}
        mapStyleUrl={mapStyleUrl()}
        photos={photos}
        uploader={<UploadForm />}
      />
    </ContributeWorkspace>
  );
}
