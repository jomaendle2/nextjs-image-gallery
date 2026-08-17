import type { GalleryImage } from "@/data/galleryData";

/**
 * What a screen reader should say in place of the photograph.
 *
 * The description first, because that is the only field that describes the
 * picture. `title` is a place — "Bali, Indonesia" — and every image on the
 * site used it as its alt text, so a reader who cannot see the photographs
 * was handed a gazetteer: fourteen place names, and not one word about what
 * any of them look like. The description ("Aerial view of pale waves") is
 * what a contributor already writes, and it is already the right sentence.
 *
 * The two are combined rather than swapped, because the place is worth
 * knowing too — it is simply not a description on its own. Where there is no
 * description the place carries it alone, which is no worse than before.
 *
 * The place comes from `location`, and only falls back to the title. Titles
 * used to be place names — every one of the first fourteen photographs was
 * called something like "Uluwatu, Bali, Indonesia" — so reading the place off
 * the title was right until the places moved into their own column and the
 * titles became names. "Aerial view of pale waves — Tide Lines" tells a
 * screen reader nothing it did not already have; the place does.
 */
export function photoAltText(image: GalleryImage): string {
  const description = image.description.trim();
  const place = (image.location ?? "").trim() || image.title.trim();

  if (description === "") {
    return place === "" ? "Photograph" : place;
  }
  if (place === "") {
    return description;
  }
  return `${description} — ${place}`;
}
