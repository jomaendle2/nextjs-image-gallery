import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import {
  BODY_SMALL,
  META,
  PAGE_TITLE,
  SECTION_HEADING,
} from "@/components/ui/field";
import { glassControl, PRIMARY_FILL } from "@/components/ui/glass-button";
import { TextLink } from "@/components/ui/TextLink";
import { WordmarkLink } from "@/components/ui/WordmarkLink";
import { listContributorsWithPreviews } from "@/lib/auth/contributors";
import { alternates } from "@/lib/metadata";
import { GROUND } from "@/lib/photo-ground";
import { count } from "@/lib/plural";

export const revalidate = 3600;

export const metadata: Metadata = {
  alternates: alternates("/photographers"),
  title: "Photographers — the beauty of earth.",
  description: "The photographers contributing to the beauty of earth.",
};

/**
 * The way in, for both directions.
 *
 * A stranger who might contribute wants to see whose company they would be
 * joining before applying — nobody submits to a gallery blind. The same page
 * gives the photographers already here a surface that sends people to their
 * work. Discovery and recruitment are the same problem.
 */
export default async function PhotographersPage() {
  const contributors = await listContributorsWithPreviews();

  return (
    <div
      className="relative min-h-dvh text-white"
      style={{ backgroundColor: GROUND }}
    >
      <div className="mx-auto w-full max-w-[1536px] px-4 py-10 sm:px-8 sm:py-14">
        <header>
          <WordmarkLink />

          <h1 className={`mt-1.5 ${PAGE_TITLE}`}>Photographers</h1>
          <p className={`mt-1 ${META}`}>
            {count(contributors.length, "photographer")}
          </p>
        </header>

        {/*
          The landmark covers the list and the invitation below it — the two
          things this page is for. The header above is identity, as on the
          photographer pages.
        */}
        <main>
          <ul className="mt-10 divide-y divide-white/[0.06] border-white/[0.06] border-y">
            {contributors.map((person) => (
              <li key={person.slug}>
                <Link
                  className="group flex items-center gap-4 py-4 transition-colors hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 sm:gap-6"
                  href={`/by/${person.slug}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-base tracking-[-0.02em] sm:text-lg">
                      {person.display_name}
                    </p>
                    <p className={`mt-0.5 ${META}`}>
                      {count(person.photo_count, "photograph")}
                    </p>
                  </div>

                  <div className="flex flex-shrink-0 gap-1.5">
                    {person.previews.map((preview) => (
                      <span
                        className="relative block size-12 overflow-hidden rounded-lg sm:size-14"
                        key={preview.id}
                      >
                        <Image
                          alt=""
                          blurDataURL={preview.blur_data_url}
                          className="object-cover"
                          fill={true}
                          placeholder="blur"
                          sizes="56px"
                          src={preview.blob_url}
                        />
                      </span>
                    ))}
                  </div>

                  <ArrowRight
                    aria-hidden="true"
                    className="hidden flex-shrink-0 text-white/25 transition-colors group-hover:text-white sm:block"
                    size={18}
                  />
                </Link>
              </li>
            ))}
          </ul>

          <section className="mt-14 max-w-prose">
            {/*
              Was "Shoot the earth?" — a pun, and a bad one: "shoot" is an
              odd verb to put beside photographs of landscapes, and a
              question mark does not make a headline friendly. Say the thing.
            */}
            <h2 className={SECTION_HEADING}>Add your photographs</h2>
            <p className={`mt-2 text-pretty ${BODY_SMALL}`}>
              The gallery is invited rather than open, which is why it stays
              small. Send us a link to your work and we will take a look.
            </p>
            {/*
              A link, not a GlassButton: this navigates, and nesting an anchor
              inside a button is invalid. It borrows the same glass treatment so
              it still reads as the primary action.

              `PRIMARY_FILL` because this is the one action this page exists to
              produce, and it was the one control on it wearing no accent —
              the teal sat on "Follow the gallery" two sections down, which is
              the secondary answer to the page's question. DESIGN.md allows one
              accent primary per view; this is that one. The subscribe link
              keeps the accent every link on a reading page has, which is a
              different permission.
            */}
            <Link
              /* A Link, which cannot nest inside a button. */
              className={glassControl(
                `mt-5 min-h-11 px-5 text-sm ${PRIMARY_FILL} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`,
              )}
              href="/contribute/apply"
            >
              Apply to contribute
            </Link>
          </section>

          {/*
            The other half of the same question.

            This page is the site's one navigational hub — it is where
            somebody who has just looked at the photographers decides what to
            do about it, and there are two honest answers: publish here, or
            hear about it when someone else does. `/subscribe` existed with
            nothing pointing at it, which is a page nobody can find.
          */}
          <section className="mt-10 max-w-prose">
            <h2 className={SECTION_HEADING}>Hear about new work</h2>
            <p className={`mt-2 text-pretty ${BODY_SMALL}`}>
              One email when new photographs go up, and nothing else. There is a
              feed too, if you would rather not give us an address.
            </p>
            {/*
              `standalone`, which is also what stops the arrow orphaning.
              Without it the anchor stays inline, so the trailing icon wrapped
              onto a line of its own — and the link measured 34px tall, under
              the floor. One word fixes both.
            */}
            <TextLink href="/subscribe" standalone={true}>
              Follow the gallery
              <ArrowRight aria-hidden="true" size={13} />
            </TextLink>
          </section>
        </main>

        {/*
          This page is the viewer's one exit, which makes it the two-click
          route to the legal notices for somebody who arrived on a
          photograph and never leaves the gallery otherwise.
        */}
        <SiteFooter className="mt-16" />
      </div>
    </div>
  );
}
