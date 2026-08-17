import { MapPin, NotebookPen } from "lucide-react";
import Image from "next/image";
import { META, META_TYPE } from "@/components/ui/field";

/**
 * One real photograph, with the two things a membership unlocks printed on it.
 *
 * The page used to describe these fields — "Not a region, the spot, written by
 * the photographer" — across two icon rows, which asks the reader to imagine
 * the product and then decide whether to buy the thing they imagined. A
 * specimen removes that step. It is also the only claim on the page that
 * cannot be overstated, because it is not a claim: these are the sentences a
 * photographer actually wrote, rendered exactly as a member sees them.
 *
 * This is a reading page, so the photograph is framed rather than full-bleed.
 * The viewer register is for looking through; this one is for reading, and a
 * full-bleed hero here would make `/membership` pretend to be the gallery.
 *
 * No accent in here, deliberately. The accent marks the one action a view was
 * opened to take, and the subscribe button is it; a second accent surface on
 * the same page means the reader has to read both to find the button. The
 * contrast between the plain caption and the boxed block already says which
 * half is paid for — colour would be repeating it.
 */
export function MembershipSpecimen({
  photo,
}: {
  photo: {
    title: string;
    location: string | null;
    precise_location: string;
    technique: string;
    display_url: string;
    blur_data_url: string | null;
    width: number;
    height: number;
  };
}) {
  return (
    /*
      Side by side from `sm`, stacked below it.
      
      Stacked everywhere, this stood 550px tall and pushed the subscribe
      button to y=908 on a 780px screen — the page had swapped one reason to
      scroll for another. Beside each other it is half that, and it uses the
      width the shell was already reserving and not spending.
    */
    <figure className="glass-hairline grid gap-0 overflow-hidden rounded-3xl sm:grid-cols-2">
      {/*
        A wide crop, not the photograph's own ratio. This is an illustration
        inside a reading page, and at 3:2 it stood 396px tall on a 594px
        column — enough to push the subscribe button off the first screen,
        which is the one thing the redesign was for.
      */}
      <div className="relative aspect-[2/1] w-full sm:aspect-auto sm:h-full sm:min-h-[19rem]">
        <Image
          alt={photo.title}
          className="object-cover"
          fill={true}
          {...(photo.blur_data_url === null
            ? {}
            : {
                placeholder: "blur" as const,
                blurDataURL: photo.blur_data_url,
              })}
          /* One image, one column, capped by the shell — no need to offer
             the browser a menu of widths it will never pick from. */
          sizes="(max-width: 768px) 100vw, 768px"
          src={photo.display_url}
        />
      </div>

      <figcaption className="flex flex-col justify-center gap-4 p-5 sm:p-6">
        <div>
          <p className="font-semibold text-white tracking-[-0.02em]">
            {photo.title}
          </p>
          {photo.location === null ? null : (
            <p className="mt-0.5 text-sm text-white/55">{photo.location}</p>
          )}
          <p className={`mt-2 ${META}`}>What everyone sees</p>
        </div>

        {/*
          The paid half, marked as such. Not blurred and not teased: a reader
          deciding whether five euros is worth it should be able to judge the
          actual writing, and one photograph's worth given away is a fair
          price for that. The gate is still real — it holds on the other
          fifteen.
        */}
        <div className="space-y-3 rounded-2xl border border-white/15 bg-white/[0.07] p-4">
          <div className="flex gap-3">
            <MapPin
              aria-hidden="true"
              className="mt-0.5 flex-shrink-0 text-white/70"
              size={15}
            />
            <p className="text-[0.9375rem] text-white leading-relaxed">
              {photo.precise_location}
            </p>
          </div>
          <div className="flex gap-3">
            <NotebookPen
              aria-hidden="true"
              className="mt-0.5 flex-shrink-0 text-white/70"
              size={15}
            />
            <p className="text-pretty text-[0.9375rem] text-white leading-relaxed">
              {photo.technique}
            </p>
          </div>
          {/*
        `META_TYPE`, not `META`: this is a raw template rather than `cn`, so
        `META`'s own `text-white/55` would sit in the same class attribute as
        the `/70` wanted here and the winner would be Tailwind's emit order.
        The same hazard `META_TYPE` was split out for, in a second place.
      */}
          <p className={`text-white/70 ${META_TYPE}`}>What members see</p>
        </div>
      </figcaption>
    </figure>
  );
}
