"use client";

import Image from "next/image";
import { type ChangeEvent, useCallback, useMemo, useState } from "react";
import { SearchField } from "@/components/ui/SearchField";
import { photoTitle } from "@/lib/photos/title";
import type { OwnPhotoRow } from "@/lib/photos/types";
import { PhotoRowActions } from "./PhotoRowActions";

/**
 * Every photograph on the site, for the owner.
 *
 * This is the list that grows fastest: one contributor's dashboard holds
 * their own work, but this holds everybody's. Five photographers is five
 * times the rows, and moderating means finding one photograph — usually
 * because somebody wrote about it — rather than reading the list top to
 * bottom.
 *
 * So it filters by photographer as well as by title, which is the question
 * actually being asked here: "show me what this person has put up." The
 * contributor's own dashboard has no such control because there is only
 * ever one name in it.
 */

function matches(photo: OwnPhotoRow, needle: string): boolean {
  if (needle === "") {
    return true;
  }
  return (
    photo.title.toLowerCase().includes(needle) ||
    (photo.location ?? "").toLowerCase().includes(needle) ||
    (photo.author_name ?? "").toLowerCase().includes(needle)
  );
}

export function AllPhotos({ photos }: { photos: OwnPhotoRow[] }) {
  const [query, setQuery] = useState("");

  const onChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value),
    [],
  );
  const clear = useCallback(() => setQuery(""), []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return photos.filter((photo) => matches(photo, needle));
  }, [photos, query]);

  return (
    <section className="mt-8">
      <h2 className="mb-3 font-semibold text-lg tracking-[-0.03em]">
        Every photograph ({photos.length})
      </h2>

      {/* Only worth the space once the list stops fitting on a screen. */}
      {photos.length > 8 ? (
        <SearchField
          className="mb-4"
          label="Search every photograph by title, location or photographer"
          onChange={onChange}
          onClear={clear}
          placeholder="Search by title, location or photographer"
          value={query}
        />
      ) : null}

      {visible.length === 0 ? (
        <p className="rounded-2xl bg-white/[0.03] px-4 py-8 text-center text-sm text-white/55">
          Nothing matches “{query}”.
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((photo) => (
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
                    {photoTitle(photo.title, "Untitled draft")}
                    {photo.is_opener ? (
                      <span className="ml-2 rounded-full bg-caution-fill px-1.5 py-0.5 text-[0.625rem] text-caution uppercase tracking-[0.08em]">
                        Opener
                      </span>
                    ) : null}
                    {photo.published_at === null ? (
                      <span className="ml-2 rounded-full bg-white/10 px-1.5 py-0.5 text-[0.625rem] text-white/60 uppercase tracking-[0.08em]">
                        Draft
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-white/55 text-xs">
                    {photo.author_name}
                  </p>
                </div>
              </div>
              <PhotoRowActions photo={photo} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
