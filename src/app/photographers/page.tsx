import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { TOUCH_LINK } from "@/components/ui/field";
import { listContributorsWithPreviews } from "@/lib/auth/contributors";
import { GROUND } from "@/lib/photo-ground";

export const revalidate = 3600;

export const metadata: Metadata = {
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
            className={`${TOUCH_LINK} gap-1.5 font-semibold text-[0.8125rem] text-white/45 tracking-[-0.02em] transition-colors hover:text-white/80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80`}
            href="/"
          >
            <ArrowLeft aria-hidden="true" size={13} />
            the beauty of earth.
          </Link>

          <h1 className="mt-1.5 font-semibold text-2xl tracking-[-0.035em] sm:text-3xl">
            Photographers
          </h1>
          <p className="mt-1 text-[0.6875rem] text-white/40 uppercase tracking-[0.14em]">
            {contributors.length}{" "}
            {contributors.length === 1 ? "contributor" : "contributors"}
          </p>
        </header>

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
                  <p className="mt-0.5 text-[0.6875rem] text-white/40 uppercase tracking-[0.14em]">
                    {person.photo_count}{" "}
                    {person.photo_count === 1 ? "photograph" : "photographs"}
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
          <h2 className="font-semibold text-xl tracking-[-0.03em]">
            Shoot the earth?
          </h2>
          <p className="mt-2 text-pretty text-sm text-white/55 leading-relaxed">
            The gallery is invited rather than open, which is why it stays
            small. If your work belongs among these, send us a link to it.
          </p>
          {/*
            A link, not a GlassButton: this navigates, and nesting an anchor
            inside a button is invalid. It borrows the same glass treatment so
            it still reads as the primary action.
          */}
          <Link
            className="glass-thin mt-5 inline-flex min-h-11 items-center rounded-2xl px-5 font-medium text-sm text-white transition-[transform,background-color] duration-300 ease-glass hover:bg-[var(--glass-fill-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 active:scale-95"
            href="/contribute/apply"
          >
            Apply to contribute
          </Link>
        </section>
      </div>
    </div>
  );
}
