import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SECTION_HEADING } from "@/components/ui/field";
import { TextLink } from "@/components/ui/TextLink";
import { listPendingApplications } from "@/lib/applications/repository";
import { listContributors } from "@/lib/auth/contributors";
import { getCurrentContributor } from "@/lib/auth/session";
import { isOwner } from "@/lib/auth/types";
import { countUnannouncedPhotos, listAllPhotos } from "@/lib/photos/repository";
import { count } from "@/lib/plural";
import { countConfirmedSubscribers } from "@/lib/subscribers/repository";
import { listEarlyAccess } from "@/lib/waitlist/repository";
import { tierName } from "@/lib/waitlist/tiers";
import { ContributeShell } from "../ContributeShell";
import { InviteForm } from "../InviteForm";
import { WorkspaceNav } from "../WorkspaceNav";
import { AllPhotos } from "./AllPhotos";
import { AnnounceActions } from "./AnnounceActions";
import { ApplicationRowActions } from "./ApplicationRowActions";
import { invite } from "./actions";
import { ContributorRowActions } from "./ContributorRowActions";

export const metadata: Metadata = {
  title: "Contributors — the beauty of earth.",
  robots: { index: false },
};

export default async function AdminPage() {
  const actor = await getCurrentContributor();
  if (!actor) {
    /*
     * `error=ended` rather than a bare redirect. A session that ran out used
     * to bounce the reader to a sign-in form with no explanation, so the page
     * they were using simply reappeared as a login screen — which from the
     * outside is indistinguishable from the site having forgotten them.
     */
    redirect("/contribute?error=ended");
  }
  /*
   * 404 rather than 403 for a signed-in non-owner: there is no reason to
   * confirm that an admin page exists to someone who cannot use it.
   */
  if (!isOwner(actor)) {
    notFound();
  }

  const [
    applications,
    contributors,
    photos,
    unannounced,
    subscribers,
    earlyAccess,
  ] = await Promise.all([
    listPendingApplications(),
    listContributors(),
    listAllPhotos(),
    countUnannouncedPhotos(),
    countConfirmedSubscribers(),
    listEarlyAccess(),
  ]);

  return (
    <ContributeShell
      back={{ href: "/contribute/photos", label: "Your photographs" }}
      nav={<WorkspaceNav current="contributors" owner={true} />}
      subtitle="Invite photographers, and moderate what appears in the gallery."
      title="Photographers"
    >
      {applications.length === 0 ? null : (
        <section className="mb-8">
          <h2 className={`mb-3 ${SECTION_HEADING}`}>
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
                  <p className="truncate text-white/55 text-xs">
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
      <AnnounceActions pending={unannounced} subscribers={subscribers} />

      {/*
        The answer to the question `/pricing` was published to ask.

        A section rather than a number, because the decision this feeds is not
        "how many" alone: six addresses with two of them naming a screen count
        is a different finding from six with none, and the note is where
        somebody says which building. It disappears entirely at zero — an
        empty table under a heading reads as a broken feature rather than as
        a result, and the result at zero is legible enough without one.
      */}
      {earlyAccess.length === 0 ? null : (
        <section className="mb-8">
          <h2 className={`mb-3 ${SECTION_HEADING}`}>
            Early access requests ({earlyAccess.length})
          </h2>
          <ul className="space-y-2">
            {earlyAccess.map((request) => (
              <li
                className="glass-hairline rounded-2xl px-4 py-3"
                key={request.id}
              >
                <p className="truncate font-medium text-sm">
                  {tierName(request.tier)}
                  {request.screens === null
                    ? null
                    : ` · ${count(request.screens, "screen")}`}
                </p>
                <p className="truncate text-white/55 text-xs">
                  {request.email}
                  {request.note === "" ? null : ` · ${request.note}`}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="glass-thin rounded-3xl p-6">
        <h2 className={`mb-1 ${SECTION_HEADING}`}>Invite a photographer</h2>
        <p className="mb-4 text-sm text-white/55">
          Adding someone here is the invitation — there is nothing for them to
          accept. They sign in at{" "}
          <code className="text-white/70">/contribute</code> with this address
          and can publish straight away.
        </p>
        <InviteForm action={invite} />
      </section>

      <section className="mt-8">
        <h2 className={`mb-3 ${SECTION_HEADING}`}>
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
                    <span className="ml-2 text-white/55">revoked</span>
                  )}
                </p>
                <p className="truncate text-white/55 text-xs">
                  {row.email} · {count(row.photo_count, "photograph")} ·{" "}
                  <TextLink href={`/by/${row.slug}`}>/by/{row.slug}</TextLink>
                  {/*
                    Who brought them in, and what they have left to spend.
                    Here and nowhere public: it tells you which invitations
                    led to good work, which is the only way to know whether
                    the mechanism is worth keeping, and it would rank
                    photographers against each other on their own pages.
                  */}
                  {row.invited_by_name === null
                    ? null
                    : ` · invited by ${row.invited_by_name}`}
                  {row.role === "owner"
                    ? null
                    : ` · ${count(row.invites_remaining, "invitation")} left`}
                </p>
              </div>
              <ContributorRowActions row={row} />
            </li>
          ))}
        </ul>
      </section>

      <AllPhotos photos={photos} />
    </ContributeShell>
  );
}
