import { generateText, Output } from "ai";
import { z } from "zod";
import type { PhotoExif } from "@/lib/photos/derive";
import { exifLine } from "@/lib/photos/exif-line";
import type { RawSuggestion } from "./suggestion";

/**
 * The one call to a model, and the words that steer it.
 *
 * Split from `offer.ts` on one side and `suggestion.ts` on the other, so that
 * exactly one module in the codebase imports the SDK. The probe answers
 * "is this switched on" without loading anything; the shaping is a pure
 * function a test can pin; this file is the part that costs money and needs
 * credentials, and it is the only part that does.
 *
 * It is given bytes, never a URL. The caller fetches the *display copy* —
 * the `sharp` re-encode that carries no metadata — because the original
 * upload still holds whatever GPS the camera wrote, and `docs/security-review.md`
 * is explicit that the original is the one file on this site that must not
 * travel. Handing a provider a URL would also hand them the choice of which
 * of the two to fetch.
 */

/**
 * A cheap model that can see, and a second one from a different vendor.
 *
 * Both verified against `https://ai-gateway.vercel.sh/v1/models` on the day
 * this was written rather than recalled: the model list moves faster than any
 * training data, and a plausible-looking wrong id is a feature that is broken
 * only in production.
 *
 * Gemini Flash first because it is the cheapest thing on the list that writes
 * a decent English sentence about a picture — a suggestion is one paragraph
 * read once by the person who took the photograph, so the money belongs in
 * the number of photographs a gallery can caption, not in the prose of any
 * one of them.
 *
 * The fallback is Anthropic rather than another Google model on purpose. What
 * a second entry buys is survival of one vendor's bad hour, and two models
 * behind the same API go down together. Both are marked as not training on
 * what is sent, which is the property that matters for other people's
 * photographs and is why the processor row in `src/lib/legal.ts` can say so.
 */
const MODEL = "google/gemini-3.7-flash";
const FALLBACK_MODELS = ["anthropic/claude-haiku-4.5"];

/**
 * Long enough for a slow first token, short enough that a photographer does
 * not sit in front of a spinner wondering whether the button worked. Retries
 * are held to one for the same reason: the alternative to a fast failure here
 * is not a better suggestion, it is a person typing their own title, which
 * they can do in less time than a third attempt takes.
 */
const TIMEOUT_MS = 25_000;
const MAX_RETRIES = 1;

/*
 * The schema is the prompt, mostly.
 *
 * Field descriptions travel to the provider as part of the tool or response
 * schema, so the instruction sits next to the thing it constrains and cannot
 * drift from it. The caps are not stated here — a model asked for "at most
 * 120 characters" writes to the limit — `shapeSuggestion` cuts instead.
 */
const SUGGESTION_SCHEMA = z.object({
  title: z
    .string()
    .describe(
      "A short name for the photograph — two to four words in Title Case, " +
        "no final full stop, like 'Tide Lines', 'Palms in the Breeze', " +
        "'Looking Up', 'Golden Gate'. It names the picture the way a print " +
        "is named; it does not restate the description, and it may be " +
        "oblique. A place name is a fine title when the place is what the " +
        "photograph is of.",
    ),
  description: z
    .string()
    .describe(
      "One plain sentence saying what is visible in the frame. This is read " +
        "aloud to people who cannot see the photograph, so describe the " +
        "picture — subject, colour, light, weather — and do not name the " +
        "place, the mood, or the camera. Like: 'Teal waves crash against " +
        "rocky cliffs.' or 'Pink cherry blossoms against a clear blue sky.'",
    ),
  location: z
    .string()
    .nullable()
    .describe(
      "The place, as short as a person writes it on a label: 'Nusa Penida', " +
        "'Sagres, Portugal', 'Bromo, Java, Indonesia' — never the official " +
        "name of a park or municipality when a shorter one is what people " +
        "say. Null unless something in the frame actually identifies it.",
    ),
  locationConfidence: z
    .enum(["high", "low"])
    .describe(
      "'high' only if a named landmark, sign, or unmistakable skyline in " +
        "this photograph would make somebody who knows the place agree. " +
        "Vegetation, light, architecture style and the general look of a " +
        "coastline are 'low' — they narrow a guess, they do not identify a " +
        "place.",
    ),
});

/**
 * The voice, stated once.
 *
 * Drawn from the descriptions already on the site rather than invented: they
 * are short, literal and unexcited, and `src/lib/photos/alt-text.ts` explains
 * why the description in particular has to describe the picture — it is what
 * a screen reader is given in place of the photograph, and for a while every
 * image here was announced as a place name and nothing else.
 */
const SYSTEM =
  "You are helping a photographer caption their own photograph for a small " +
  "gallery of landscape and nature photography. Write the way a person " +
  "labels their own work: plain, concrete, unhurried. No marketing " +
  "adjectives — nothing is breathtaking, stunning or majestic. No " +
  "exclamation marks, no hashtags, no second person, no talk of the camera " +
  "or the settings. Where you are unsure, say less rather than guessing: " +
  "the photographer will read every word of this and knows what you do not.";

/** What the route hands over: the display copy, and what the file remembered. */
export interface SuggestionSource {
  /** Bytes of the display copy. JPEG, because that is what `derive` writes. */
  image: Uint8Array;
  exif: PhotoExif | null;
}

/**
 * The exposure line and the time of day, as one line of context.
 *
 * Given rather than guessed. The file already knows the camera, the lens and
 * the moment the shutter opened, and a model that has to infer late-afternoon
 * light from the colour of a cliff will sometimes infer it wrong — which then
 * shows up in a sentence a screen reader reads out as fact. `exifLine`
 * formats the exposure exactly as both the dashboard and the viewer print it.
 *
 * Returns null when the file said nothing, so the prompt carries no empty
 * heading pretending to be data.
 */
function contextLine(exif: PhotoExif | null): string | null {
  const parts = [exifLine(exif)];
  if (exif?.taken_at !== undefined) {
    parts.push(`taken ${exif.taken_at}`);
  }
  const known = parts.filter((part): part is string => part !== null);
  return known.length > 0 ? known.join(" · ") : null;
}

/**
 * Asks a model to look at one photograph and propose three fields.
 *
 * Throws on anything the provider does — a refusal, a timeout, a schema the
 * model would not fill in. The caller logs that and says something else to
 * the photographer; a provider's error text is never forwarded, which is the
 * discipline `src/app/api/photos/draft/route.ts` set with `TellTheUser`.
 */
export async function suggestForPhotograph(
  source: SuggestionSource,
): Promise<RawSuggestion> {
  const context = contextLine(source.exif);

  /*
   * `generateText` with an `Output.object`, not `generateObject`.
   *
   * `generateObject` is what a from-memory version of this call would use,
   * and it still exists — but it is deprecated in the installed SDK, and the
   * lint rule that reads `@deprecated` annotations is what said so before
   * anything shipped. Structured output is now a property of an ordinary
   * generation rather than a separate function.
   */
  const { output, usage, finishReason } = await generateText({
    model: MODEL,
    output: Output.object({ schema: SUGGESTION_SCHEMA }),
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Suggest a title, a description and a place for this " +
              "photograph." +
              (context === null ? "" : ` The file records: ${context}.`),
          },
          {
            /*
             * `file` with an image media type, not the `image` part this SDK
             * used to take. Checked against `node_modules/ai/docs`, which is
             * the only reason it is right — the older shape is what a
             * from-memory version of this call would have used.
             */
            type: "file",
            mediaType: "image/jpeg",
            data: source.image,
          },
        ],
      },
    ],
    /*
     * The gateway's own fallback list, which is why there is no retry loop
     * here: one call, two vendors, and the second is tried only if the first
     * cannot answer at all.
     */
    providerOptions: { gateway: { models: FALLBACK_MODELS } },
    maxRetries: MAX_RETRIES,
    abortSignal: AbortSignal.timeout(TIMEOUT_MS),
  });

  console.warn("TEMP usage", JSON.stringify(usage), finishReason);
  return output;
}
