"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ViewCount } from "@/components/gallery/ViewCount";
import { META } from "@/components/ui/field";
import { SheetContent } from "@/components/ui/Sheet";
import type { GalleryImage } from "@/data/galleryData";
import { exifLine } from "@/lib/photos/exif-line";
import { MemberDetails } from "./MemberDetails";
import { WorldDot } from "./WorldDot";

/**
 * Everything about one photograph that is not the photograph.
 *
 * These seven things used to sit on the image in three stacked rows in the
 * bottom-right corner, in three different type treatments, on a caption bar
 * that is in flex flow — so each of them was subtracting height from the
 * photograph in order to be read. Here they get room and a reading order,
 * and the photograph gets the pixels back.
 *
 * No accent anywhere in this file. This is the viewer, and the only colour in
 * the viewer comes from the photograph.
 */

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-white/[0.08] border-t pt-4">
      <dt className={META}>{label}</dt>
      <dd className="mt-1.5 text-[0.9375rem] text-white/85 leading-relaxed">
        {children}
      </dd>
    </div>
  );
}

export function PhotoDetails({ image }: { image: GalleryImage }) {
  const { author, location, description, pin } = image;
  const exif = exifLine(image.exif ?? null);

  /*
   * Whether the name links is a fact about where we are, not something the
   * carousel needs to pass down. Both of the photographer's own routes are
   * covered, and the boundary check keeps `/by/anna-b` from suppressing the
   * link on a page about `/by/anna`.
   */
  const pathname = usePathname();
  const ownPage = `/by/${author.slug}`;
  const onOwnPage = pathname === ownPage || pathname.startsWith(`${ownPage}/`);

  return (
    <SheetContent title={image.title === "" ? "This photograph" : image.title}>
      {description === "" ? null : (
        <p className="text-pretty text-sm text-white/60 leading-relaxed">
          {description}
        </p>
      )}

      <dl className="flex flex-col gap-4">
        <Field label="Photograph by">
          {onOwnPage ? (
            <span>{author.name}</span>
          ) : (
            <Link
              className="rounded-sm underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-white/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80"
              href={ownPage}
            >
              {author.name}
            </Link>
          )}
          {author.siteUrl === null ? null : (
            <a
              className="-my-3 ml-3 inline-flex min-h-11 items-center gap-1 rounded-sm py-3 text-sm text-white/55 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80"
              href={author.siteUrl}
              rel="noopener noreferrer nofollow"
              target="_blank"
            >
              Their site
              <ArrowUpRight aria-hidden="true" size={13} />
            </a>
          )}
        </Field>

        {/*
          The public half of "where", both in words and as a picture.

          It lives in the sheet rather than under the photograph, and that is
          not a layout preference. `CaptionBar` and `ImageInfo` reserve
          `min-h-9` precisely because the bar is in flex flow below the
          image, so anything added there subtracts height from the
          photograph — three photographs in fourteen used to be 18px taller
          and moved the whole dock when selected. There is no room under the
          image and this must not make some.

          Shown whenever either exists: a photographer may name a place
          without marking one, or mark one without naming it.
        */}
        {location === null && pin === null ? null : (
          <Field label="Where">
            {location}
            {pin === null ? null : <WorldDot pin={pin} />}
          </Field>
        )}

        {/*
          Where exactly, and how it was made — for members. Its own request,
          so the page stays cacheable and the data never reaches somebody who
          has not paid for it.
        */}
        <div className="border-white/[0.08] border-t pt-4">
          <MemberDetails photoId={image.id} />
        </div>

        {/*
          The exposure line, no longer hidden below `sm`. It was hidden there
          because it was competing with the caption for the bottom of a phone
          screen; in a panel that someone chose to open, there is nothing to
          compete with.
        */}
        {exif === null ? null : (
          <Field label="Exposure">
            <span className="text-[0.8125rem] tabular-nums">{exif}</span>
          </Field>
        )}
      </dl>

      {/*
        The count again, in full rather than as the abbreviated glance
        outside. No share button here: the one in the caption bar is the share
        control, and a second instance would keep its own tick state, so the
        same photograph would read as copied in one place and not the other.
      */}
      <div className="mt-auto border-white/[0.08] border-t pt-4">
        <ViewCount imageId={image.id} variant="modal" />
      </div>
    </SheetContent>
  );
}
