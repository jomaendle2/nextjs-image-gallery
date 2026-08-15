import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { listPendingApplications } from "@/lib/applications/repository";
import { listContributors } from "@/lib/auth/contributors";
import { getCurrentContributor } from "@/lib/auth/session";
import { isOwner } from "@/lib/auth/types";
import { listAllPhotos, listUnannouncedPhotos } from "@/lib/photos/repository";
import { listConfirmedSubscribers } from "@/lib/subscribers/repository";
import { ContributeShell } from "../ContributeShell";
import { AnnounceActions } from "./AnnounceActions";
import { ApplicationRowActions } from "./ApplicationRowActions";
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

  const [applications, contributors, photos, unannounced, subscribers] =
    await Promise.all([
      listPendingApplications(),
      listContributors(),
      listAllPhotos(),
      listUnannouncedPhotos(),
      listConfirmedSubscribers(),
    ]);

  return (
    <ContributeShell
      subtitle="Invite photographers, and moderate what appears in the gallery."
      title="Contributors"
    >
      {applications.length === 0 ? null : (
        <section className="mb-8">
          <h2 className="mb-3 font-semibold text-lg tracking-[-0.03em]">
            Pending applications ({applications.length})
          </h2>
          <ul className="space-y-2">
            {applications.map((application) => (
              <li
                className="glass-hairline flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3"
                key={application.id}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-sm">
                    {application.display_name}
                    <a
                      className="ml-2 inline-flex items-center gap-0.5 text-white/55 underline underline-offset-2 transition-colors hover:text-white"
                      href={application.site_url}
                      rel="noopener noreferrer nofollow"
                      target="_blank"
                    >
                      see their work
                      <ArrowUpRight aria-hidden="true" size={12} />
                    </a>
                  </p>
                  <p className="truncate text-white/45 text-xs">
                    {application.email}
                    {application.note === null
                      ? null
                      : ` · ${application.note}`}
                  </p>
                </div>
                <ApplicationRowActions id={application.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/*
        The component decides whether it appears at all — see the note in
        `AnnounceActions` about the confirmation outliving the panel.
      */}
      <AnnounceActions
        pending={unannounced.length}
        subscribers={subscribers.length}
      />

      <section className="glass-thin rounded-3xl p-6">
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
              className="glass-hairline flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3"
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
              className="glass-hairline flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3"
              key={photo.id}
            >
              {/*
                The photograph itself, because this is the row where somebody
                decides whether it stays up.

                Moderating by title alone is workable right up until two
                photographs share one — there are already two called
                "Böblingen, Germany" in this list, indistinguishable, sitting
                next to an Unpublish button. Forty pixels of the actual image
                is the difference between a decision and a guess.
              */}
              <div className="flex min-w-0 items-center gap-3">
                <Image
                  alt=""
                  blurDataURL={photo.blur_data_url}
                  className="size-10 flex-shrink-0 rounded-lg object-cover"
                  height={40}
                  placeholder="blur"
                  // Well below the fold on a list this long, and the operator
                  // scrolls to what they came for.
                  loading="lazy"
                  sizes="40px"
                  src={photo.blob_url}
                  width={40}
                />
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
              </div>
              <PhotoRowActions photo={photo} />
            </li>
          ))}
        </ul>
      </section>
    </ContributeShell>
  );
}
