import { readFile } from "node:fs/promises";
import process from "node:process";
import { put } from "@vercel/blob";
import { sql } from "../src/lib/database.ts";
import { deriveFromBuffer } from "../src/lib/photos/derive.ts";

/**
 * Moves the original gallery out of `src/assets` and into Blob + Postgres.
 *
 * This has already been run, and `src/assets` was deleted afterwards — 162 MB
 * of JPEGs that nothing imported any more. The script is kept because it is
 * the record of where the first fourteen photographs and their authored
 * titles came from. To re-run it, restore the directory first:
 * `git checkout <commit-before-removal> -- src/assets`.
 *
 * Two things are deliberately preserved rather than regenerated:
 *
 * 1. **The ids.** `image_views` has been counting against "1".."14" since the
 *    site launched. `photos.id` is TEXT, so reusing those ids carries every
 *    accumulated view across instead of orphaning it.
 * 2. **The titles, descriptions and colours.** These were authored by hand.
 *    Derivation produces a dominant colour, but it only approximates a chosen
 *    one, so it is used for new uploads and ignored here.
 */
const OWNER = {
  email: "maendle.johannes@gmail.com",
  display_name: "Jo Mändle",
  slug: "jo-maendle",
};

interface Seed {
  id: string;
  file: string;
  title: string;
  description: string;
  bgColor: string;
}

/** In display order. The first entry becomes the pinned opener. */
const SEEDS: Seed[] = [
  {
    id: "1",
    file: "waves.jpg",
    title: "Bali, Indonesia",
    description: "Aerial view of tale waves",
    bgColor: "#2a6b7c",
  },
  {
    id: "2",
    file: "0.jpg",
    title: "Vila Nova de Milfontes, Portugal",
    description: "Beautiful coastal landscape in Portugal",
    bgColor: "#191815",
  },
  {
    id: "3",
    file: "1.jpg",
    title: "Bali, Indonesia",
    description: "A beautiful, blooming Plumeria rubra flower",
    bgColor: "#4c89a1",
  },
  {
    id: "4",
    file: "2.jpg",
    title: "Bromo, Java, Indonesia",
    description: "Peaceful sunrise at Bromo Tengger Semeru National Park",
    bgColor: "#663829",
  },
  {
    id: "5",
    file: "cherry.jpg",
    title: "Böblingen, Germany",
    description: "Pink cherry blossoms against a clear blue sky.",
    bgColor: "#4c566e",
  },
  {
    id: "6",
    file: "3.jpg",
    title: "Uluwatu, Bali, Indonesia",
    description: "Teal waves crash against rocky cliffs.",
    bgColor: "#446165",
  },
  {
    id: "7",
    file: "4.jpg",
    title: "Sagres, Portugal",
    description: "A golden sunset glows over gentle waves on a sandy shore.",
    bgColor: "#6a4332",
  },
  {
    id: "8",
    file: "5.jpg",
    title: "San Diego, California",
    description: "Close-up of a vibrant palm tree nearby the beach.",
    bgColor: "#4d623c",
  },
  {
    id: "9",
    file: "9.jpg",
    title: "Koh Samui, Thailand",
    description: "White plumeria blossoms against a clear blue sky.",
    bgColor: "#2a88a3",
  },
  {
    id: "10",
    file: "rio.jpg",
    title: "Rio de Janeiro, Brazil",
    description: "Aerial view of the iconic Rio de Janeiro coastline.",
    bgColor: "#3a5c7b",
  },
  {
    id: "11",
    file: "6.jpg",
    title: "San Francisco, California",
    description: "Golden Gate Bridge at sunset with a vibrant sky.",
    bgColor: "#2184ab",
  },
  {
    id: "12",
    file: "7.jpg",
    title: "Arches National Park, Utah",
    description:
      "Storm clouds roll over towering red sandstone formations in Arches NP",
    bgColor: "#646378",
  },
  {
    id: "13",
    file: "8.jpg",
    title: "Böblingen, Germany",
    description: "Pink cherry blossoms against a clear blue sky.",
    bgColor: "#136aa0",
  },
  {
    id: "14",
    file: "10.jpg",
    title: "Koh Phangan, Thailand",
    description: "Lovely palm trees swaying in the breeze on a tropical beach.",
    bgColor: "#87abab",
  },
];

const MINUTE_MS = 60_000;

async function ensureOwner(): Promise<string> {
  const existing = await sql`
    SELECT id FROM contributors WHERE email = ${OWNER.email};
  `;
  const found = existing[0]?.["id"] as string | undefined;
  if (found !== undefined) {
    return found;
  }
  const inserted = await sql`
    INSERT INTO contributors (id, email, slug, display_name, role)
    VALUES ('owner', ${OWNER.email}, ${OWNER.slug}, ${OWNER.display_name},
            'owner')
    RETURNING id;
  `;
  return inserted[0]?.["id"] as string;
}

async function main(): Promise<void> {
  const [{ count }] =
    (await sql`SELECT count(*)::int AS count FROM photos;`) as [
      { count: number },
    ];
  if (count > 0) {
    console.log(`Photos already imported (${count} rows); nothing to do.`);
    return;
  }

  const authorId = await ensureOwner();
  console.log(`Owner contributor: ${authorId}`);

  /*
   * The feed is newest-first, so the intended display order maps onto
   * descending publish times. The first seed also gets `is_opener`, which
   * keeps it in front even once contributors start publishing.
   */
  const base = Date.now();

  for (const [index, seed] of SEEDS.entries()) {
    const buffer = await readFile(`src/assets/${seed.file}`);
    const derived = await deriveFromBuffer(buffer);

    const blob = await put(`photos/${seed.id}-${seed.file}`, buffer, {
      access: "public",
      addRandomSuffix: true,
      contentType: "image/jpeg",
    });

    const publishedAt = new Date(base - index * MINUTE_MS).toISOString();

    await sql`
      INSERT INTO photos (id, blob_url, blob_pathname, width, height,
                          blur_data_url, bg_color, title, description, exif,
                          author_id, published_at, is_opener)
      VALUES (${seed.id}, ${blob.url}, ${blob.pathname}, ${derived.width},
              ${derived.height}, ${derived.blur_data_url}, ${seed.bgColor},
              ${seed.title}, ${seed.description},
              ${JSON.stringify(derived.exif)}::jsonb, ${authorId},
              ${publishedAt}, ${index === 0});
    `;

    console.log(
      `uploaded ${seed.file} -> ${blob.pathname} ` +
        `(${derived.width}x${derived.height})`,
    );
  }

  console.log(`Imported ${SEEDS.length} photos.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
