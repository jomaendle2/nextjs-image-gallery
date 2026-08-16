import type { MetadataRoute } from "next";

/**
 * Replaces the `public/site.webmanifest` a favicon generator left behind.
 *
 * That file had an empty `name` and `short_name`, so adding the gallery to a
 * home screen produced an untitled icon; it declared white for both
 * `theme_color` and `background_color`, so launching it flashed a white
 * screen before a near-black photo gallery; and nothing linked to it, so
 * none of that had ever been seen.
 *
 * Here it is typed, checked at build time, and served at `/manifest.webmanifest`
 * with Next linking it into every page — which also means the colours below
 * cannot drift from the ones in `globals.css` without somebody noticing.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "the beauty of earth.",
    short_name: "beauty of earth",
    description:
      "Photographs from around the world, by a small group of invited photographers.",
    start_url: "/",
    display: "standalone",
    /*
     * `--ground`, the colour the viewer sits on, so the launch screen is
     * already the gallery's background before a photograph has loaded.
     */
    background_color: "#0b0e12",
    /*
     * The same `--ground`, and it must stay that way.
     *
     * This said teal, with a comment claiming it matched the layout — it did
     * not. An installed Android app takes its toolbar colour from here while
     * an ordinary tab takes it from the layout's `themeColor`, so the same
     * gallery had near-black chrome in the browser and teal chrome on the
     * home screen, over a near-black splash. Exactly the flash of the wrong
     * colour this file exists to prevent.
     *
     * The claim is now a test rather than a comment — see `manifest.test.ts`.
     */
    theme_color: "#0b0e12",
    orientation: "any",
    icons: [
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
