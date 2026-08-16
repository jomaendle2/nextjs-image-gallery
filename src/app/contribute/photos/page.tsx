import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GlassButton } from "@/components/ui/glass-button";
import { TextLink } from "@/components/ui/TextLink";
import { getCurrentContributor } from "@/lib/auth/session";
import { isOwner } from "@/lib/auth/types";
import { listOwnPhotos } from "@/lib/photos/repository";
import { signOut } from "../actions";
import { ContributeShell } from "../ContributeShell";
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

  const photos = await listOwnPhotos(contributor.id);
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
      </div>

      <UploadForm />

      <PhotoList photos={photos} />
    </ContributeShell>
  );
}
