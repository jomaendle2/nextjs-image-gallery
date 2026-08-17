import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { META, TOUCH_LINK } from "@/components/ui/field";
import { glassControl } from "@/components/ui/glass-button";
import { TextLink } from "@/components/ui/TextLink";
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
          <Link
            className={`${TOUCH_LINK} gap-1.5 font-semibold text-[0.8125rem] text-white/55 tracking-[-0.02em] transition-colors hover:text-white/80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80`}
            href="/"
          >
            <ArrowLeft aria-hidden="true" size={13} />
            the beauty of earth.
          </Link>

          <h1 className="mt-1.5 font-semibold text-2xl tracking-[-0.035em] sm:text-3xl">
            Photographers
          </h1>
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
            <h2 className="font-semibold text-xl tracking-[-0.03em]">
              Add your photographs
            </h2>
            <p className="mt-2 text-pretty text-sm text-white/55 leading-relaxed">
              The gallery is invited rather than open, which is why it stays
              small. Send us a link to your work and we will take a look.
            </p>
            {/*
              A link, not a GlassButton: this navigates, and nesting an anchor
              inside a button is invalid. It borrows the same glass treatment so
              it still reads as the primary action.
            */}
            <Link
              /* A Link, which cannot nest inside a button. */
              className={glassControl(
                "mt-5 min-h-11 px-5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80",
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
            <h2 className="font-semibold text-xl tracking-[-0.03em]">
              Hear about new work
            </h2>
            <p className="mt-2 text-pretty text-sm text-white/55 leading-relaxed">
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
