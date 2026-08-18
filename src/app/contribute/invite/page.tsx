import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SECTION_HEADING } from "@/components/ui/field";
import { Notice } from "@/components/ui/Notice";
import { TextLink } from "@/components/ui/TextLink";
import { invitesRemaining, listInvitees } from "@/lib/auth/contributors";
import { getCurrentContributor } from "@/lib/auth/session";
import { isOwner } from "@/lib/auth/types";
import { OPERATOR } from "@/lib/legal";
import { count } from "@/lib/plural";
import { ContributeShell } from "../ContributeShell";
import { InviteForm } from "../InviteForm";
import { WorkspaceNav } from "../WorkspaceNav";
import { inviteAsContributor } from "./actions";

export const metadata: Metadata = {
  title: "Invite a photographer — the beauty of earth.",
  robots: { index: false },
};

/**
 * A photographer bringing in a photographer.
 *
 * Its own route rather than a panel on `/contribute/photos`, because that
 * page's list has no upper bound and a form underneath six hundred rows is
 * not a form anybody finds.
 *
 * The three are stated on the page rather than left to be discovered by
 * running out. An invitation somebody spends carelessly because they did not
 * know it was scarce is the failure mode worth designing against.
 */
export default async function InvitePage() {
  const contributor = await getCurrentContributor();
  if (!contributor) {
    /*
     * `error=ended` rather than a bare redirect. A session that ran out used
     * to bounce the reader to a sign-in form with no explanation, so the page
     * they were using simply reappeared as a login screen — which from the
     * outside is indistinguishable from the site having forgotten them.
     */
    redirect("/contribute?error=ended");
  }

  const [remaining, invitees] = await Promise.all([
    invitesRemaining(contributor.id),
    listInvitees(contributor.id),
  ]);

  return (
    <ContributeShell
      back={{ href: "/contribute/photos", label: "Your photographs" }}
      nav={<WorkspaceNav current="invite" owner={isOwner(contributor)} />}
      subtitle="The gallery grows by photographers bringing in photographers."
      title="Invite a photographer"
    >
      <p className="max-w-prose text-sm text-white/55">
        You have three invitations, and they are not replaced. Whoever you bring
        in can publish straight away and gets three of their own, so spend them
        on people whose work you would want to sit beside yours.
      </p>

      <div className="mt-6 mb-8">
        {remaining > 0 ? (
          <p className="font-medium text-accent text-sm">
            {count(remaining, "invitation")} left
          </p>
        ) : (
          <Notice tone="warning">
            You have used all three. Ask {OPERATOR.name} if you have somebody in
            mind.
          </Notice>
        )}
      </div>

      <InviteForm
        action={inviteAsContributor}
        remaining={remaining}
        submitLabel="Send the invitation"
      />

      {invitees.length === 0 ? null : (
        <section className="mt-12">
          <h2 className={SECTION_HEADING}>You brought in</h2>
          <ul className="mt-4 space-y-2">
            {invitees.map((person) => (
              <li
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-white/[0.06] border-b pb-2 text-sm"
                key={person.slug}
              >
                {/*
                  No link where there is nothing behind it.

                  `/by/{slug}` for a photographer who has published nothing is
                  an empty page, and offering it next to the words "nothing
                  published yet" is offering a click that answers a question
                  already answered in the same row. `/photographers` withholds
                  it too, though it gets there differently — an inner join
                  simply never lists them.
                */}
                {person.published_count === 0 ? (
                  <span>{person.display_name}</span>
                ) : (
                  <TextLink href={`/by/${person.slug}`}>
                    {person.display_name}
                  </TextLink>
                )}
                <span className="text-white/55 text-xs">
                  {person.published_count === 0
                    ? "nothing published yet"
                    : count(person.published_count, "photograph")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </ContributeShell>
  );
}
