import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GlassButton } from "@/components/ui/glass-button";
import { TextLink } from "@/components/ui/TextLink";
import { invitesRemaining } from "@/lib/auth/contributors";
import { getCurrentContributor } from "@/lib/auth/session";
import { isOwner } from "@/lib/auth/types";
import { mapStyleUrl } from "@/lib/maptiler";
import { listOwnPhotos } from "@/lib/photos/repository";
import { count } from "@/lib/plural";
import { signOut } from "../actions";
import { ContributeShell } from "../ContributeShell";
import { FirstRun } from "./FirstRun";
import { PhotoList } from "./PhotoList";
import { UploadForm } from "./UploadForm";

export const metadata: Metadata = {
  title: "Your photographs — the beauty of earth.",
  robots: { index: false },
};

export default async function PhotosPage() {
  const contributor = await getCurrentContributor();
  if (!contributor) {
    redirect("/contribute");
  }

  const [photos, invites] = await Promise.all([
    listOwnPhotos(contributor.id),
    invitesRemaining(contributor.id),
  ]);
  const published = photos.filter((photo) => photo.published_at !== null);

  return (
    <ContributeShell
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
      <div className="mb-8 flex flex-wrap gap-3">
        {published.length > 0 ? (
          <TextLink href={`/by/${contributor.slug}`} standalone={true}>
            View your public page
          </TextLink>
        ) : null}
        {isOwner(contributor) ? (
          <TextLink href="/contribute/admin" standalone={true}>
            Manage contributors
          </TextLink>
        ) : null}
        {/*
          Hidden once spent, rather than shown as a dead "0 left". The count
          is the whole message: somebody who has three is being told they can
          bring people in, and somebody who has none has nothing to act on.
        */}
        {invites > 0 ? (
          <TextLink href="/contribute/invite" standalone={true}>
            Invite a photographer ({count(invites, "invitation")} left)
          </TextLink>
        ) : null}
      </div>

      {/*
        Before the upload box rather than after it, and only until the first
        photograph is live. It answers the questions somebody has while looking
        at the file input, and the most important of them — that nobody reviews
        any of this — was answered nowhere on the site.
      */}
      {published.length === 0 ? <FirstRun /> : null}

      <UploadForm />

      {/*
        The tile key is read here, on the server, and handed down as a prop.
        `NEXT_PUBLIC_MAPTILER_KEY` would have been one word shorter and would
        have compiled the key into every client bundle on the site, including
        the ones anonymous visitors receive.
      */}
      <PhotoList mapStyleUrl={mapStyleUrl()} photos={photos} />
    </ContributeShell>
  );
}
