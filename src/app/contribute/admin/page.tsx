import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { listContributors } from "@/lib/auth/contributors";
import { getCurrentContributor } from "@/lib/auth/session";
import { isOwner } from "@/lib/auth/types";
import { listAllPhotos } from "@/lib/photos/repository";
import { ContributeShell } from "../ContributeShell";
import { ContributorRowActions } from "./ContributorRowActions";
import { InviteForm } from "./InviteForm";
import { PhotoRowActions } from "./PhotoRowActions";

export const metadata: Metadata = {
  title: "Contributors — the beauty of earth.",
  robots: { index: false },
};

export default async function AdminPage() {
  const actor = await getCurrentContributor();
  if (!actor) {
    redirect("/contribute");
  }
  /*
   * 404 rather than 403 for a signed-in non-owner: there is no reason to
   * confirm that an admin page exists to someone who cannot use it.
   */
  if (!isOwner(actor)) {
    notFound();
  }

  const [contributors, photos] = await Promise.all([
    listContributors(),
    listAllPhotos(),
  ]);

  return (
    <ContributeShell
      subtitle="Invite photographers, and moderate what appears in the gallery."
      title="Contributors"
    >
      <section className="rounded-3xl border border-white/12 bg-white/5 p-6">
        <h2 className="mb-1 font-semibold text-lg tracking-[-0.03em]">
          Invite a photographer
        </h2>
        <p className="mb-4 text-sm text-white/55">
          Adding someone here is the invitation — there is nothing for them to
          accept. They sign in at{" "}
          <code className="text-white/70">/contribute</code> with this address
          and can publish straight away.
        </p>
        <InviteForm />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-semibold text-lg tracking-[-0.03em]">
          People ({contributors.length})
        </h2>
        <ul className="space-y-2">
          {contributors.map((row) => (
            <li
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
              key={row.id}
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-sm">
                  {row.display_name}
                  {row.revoked_at === null ? null : (
                    <span className="ml-2 text-white/40">revoked</span>
                  )}
                </p>
                <p className="truncate text-white/45 text-xs">
                  {row.email} · {row.photo_count}{" "}
                  {row.photo_count === 1 ? "photo" : "photos"} ·{" "}
                  <Link
                    className="underline underline-offset-2 hover:text-white"
                    href={`/by/${row.slug}`}
                  >
                    /by/{row.slug}
                  </Link>
                </p>
              </div>
              <ContributorRowActions row={row} />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-semibold text-lg tracking-[-0.03em]">
          Every photograph ({photos.length})
        </h2>
        <ul className="space-y-2">
          {photos.map((photo) => (
            <li
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
              key={photo.id}
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-sm">
                  {photo.title === "" ? "Untitled draft" : photo.title}
                  {photo.is_opener ? (
                    <span className="ml-2 text-white/50">opener</span>
                  ) : null}
                  {photo.published_at === null ? (
                    <span className="ml-2 text-white/40">draft</span>
                  ) : null}
                </p>
                <p className="truncate text-white/45 text-xs">
                  {photo.author_name}
                </p>
              </div>
              <PhotoRowActions photo={photo} />
            </li>
          ))}
        </ul>
      </section>
    </ContributeShell>
  );
}
