import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TOUCH_LINK } from "@/components/ui/field";
import { GlassButton } from "@/components/ui/glass-button";
import { getCurrentContributor } from "@/lib/auth/session";
import { isOwner } from "@/lib/auth/types";
import { listOwnPhotos } from "@/lib/photos/repository";
import { signOut } from "../actions";
import { ContributeShell } from "../ContributeShell";
import { PhotoCard } from "./PhotoCard";
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
          <Link
            className={`${TOUCH_LINK} text-sm text-white/60 underline underline-offset-4 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80`}
            href={`/by/${contributor.slug}`}
          >
            View your public page
          </Link>
        ) : null}
        {isOwner(contributor) ? (
          <Link
            className={`${TOUCH_LINK} text-sm text-white/60 underline underline-offset-4 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80`}
            href="/contribute/admin"
          >
            Manage contributors
          </Link>
        ) : null}
      </div>

      <UploadForm />

      {photos.length === 0 ? (
        <p className="mt-8 text-white/55">
          Nothing here yet. Upload your first photograph above.
        </p>
      ) : (
        <ul className="mt-8 space-y-5">
          {photos.map((photo) => (
            <PhotoCard key={photo.id} photo={photo} />
          ))}
        </ul>
      )}
    </ContributeShell>
  );
}
