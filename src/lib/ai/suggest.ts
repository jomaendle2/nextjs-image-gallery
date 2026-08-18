import { Output, streamText } from "ai";
import { z } from "zod";
import type { PhotoExif } from "@/lib/photos/derive";
import { exifLine } from "@/lib/photos/exif-line";
import type { PartialRawSuggestion, RawSuggestion } from "./suggestion";

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

/**
 * A ceiling on what one press of the button can cost.
 *
 * The schema constrains the *shape* of the answer and not its length, and
 * `shapeSuggestion` cuts a long description to 300 characters only after the
 * whole thing has been generated and paid for. `.max(2)` on places is a Zod
 * assertion for the same reason — it rejects a third place, it does not stop
 * the model writing one.
 *
 * Generous rather than tight, because the primary model reasons before it
 * writes: a measured run spends around 265 tokens thinking and 40 answering,
 * so a cap that only counted the visible sentence would truncate every reply.
 * This is a backstop against a runaway generation, not a budget.
 */
const MAX_OUTPUT_TOKENS = 2000;

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
  /*
   * Last, and the order is load-bearing now that this streams.
   *
   * A model emits JSON keys in schema order, and the interface renders each
   * field as the characters arrive. The two sentences are what somebody
   * watches for; the places are a list of buttons that appear underneath
   * once there is something to click, and a list that materialises before
   * the caption it belongs to would move the whole form under the cursor.
   */
  places: z
    .array(
      z.object({
        /*
         * Before the name it judges, for the same reason the verdict used to
         * come before the location: a chip renders as soon as it has a name,
         * and a chip that appears unlabelled and then acquires a hedge has
         * already been read as confident.
         */
        confidence: z
          .enum(["high", "low"])
          .describe(
            "'high' only if a named landmark, sign, or unmistakable skyline " +
              "in this photograph would make somebody who knows the place " +
              "agree. Vegetation, light, architecture style and the general " +
              "look of a coastline are 'low' — they narrow a guess, they do " +
              "not identify a place. A 'low' answer is welcome here: it is " +
              "shown as a hedged suggestion nobody is obliged to accept.",
          ),
        name: z
          .string()
          .describe(
            "The place, as short as a person writes it on a label: 'Nusa " +
              "Penida', 'Sagres, Portugal', 'Bromo, Java, Indonesia' — never " +
              "the official name of a park or municipality when a shorter " +
              "one is what people say.",
          ),
        reason: z
          .string()
          .describe(
            "One short clause naming what in this frame points there — 'the " +
              "lighthouse on the headland', 'limestone arches and red " +
              "cliffs'. It is shown beside the name so the photographer can " +
              "check the guess against their own photograph. No hedging " +
              "words; the confidence field says that.",
          ),
        lat: z
          .number()
          .nullable()
          .describe(
            "Approximate latitude of that place, or null if you cannot give " +
              "one. A rough centre is useful; a fabricated decimal is not.",
          ),
        lng: z
          .number()
          .nullable()
          .describe("Approximate longitude, or null. Null unless lat is set."),
      }),
    )
    .max(2)
    .describe(
      "The places this photograph might have been taken, likeliest first. " +
        "Empty when nothing in the frame points anywhere — that is a good " +
        "answer, not a failure. Give a second entry only when it is a real " +
        "alternative somebody might pick instead of the first, never to pad " +
        "the list.",
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
 * What one call produces: the fields as they are being written, then the
 * finished set.
 *
 * Both halves, because they are not the same thing and only one of them is
 * trustworthy. A partial is a prefix of a sentence the model has not finished
 * — good enough to show somebody so they can see it working, never good
 * enough to be the final content of a field. `complete` is the validated
 * object, and it is what the form ends up holding.
 */
export interface SuggestionRun {
  parts: AsyncIterable<PartialRawSuggestion>;
  complete: PromiseLike<RawSuggestion>;
}

/**
 * Asks a model to look at one photograph and propose a name, a sentence and
 * the places it might be, reporting as it writes them.
 *
 * Streaming rather than one answer at the end, and the reason is what the
 * wait feels like rather than what it costs: a vision model takes several
 * seconds over a photograph, and a button that says "Looking…" for six of
 * them is indistinguishable from a button that has failed. The same six
 * seconds spent watching a title appear a word at a time is the model showing
 * its work.
 *
 * Errors from a stream do not arrive as a thrown call — the SDK puts them in
 * the stream instead, so that a provider dying mid-sentence cannot crash the
 * process. Both the iteration and `complete` will reject; the caller is
 * expected to handle either, and the route does. A provider's error text is
 * still never forwarded, which is the discipline
 * `src/app/api/photos/draft/route.ts` set with `TellTheUser`.
 */
export function suggestForPhotograph(
  source: SuggestionSource,
  /**
   * The request's own signal, so a reader who leaves stops the generation.
   *
   * Without it the model call outlived the person who asked for it: closing
   * the tab, navigating away, or pressing the button a second time left the
   * first call running to completion and billed in full. The timeout below
   * bounded how long a *waiting* photographer sits there; it never bounded
   * work nobody was waiting for.
   */
  signal?: AbortSignal,
): SuggestionRun {
  const context = contextLine(source.exif);

  /*
   * Either reason to stop, as one signal.
   *
   * `AbortSignal.any` settles as soon as the first of them fires and drops
   * its listeners when it does, so the timer cannot keep a finished request
   * alive. When there is no request signal this is just the timeout.
   */
  const deadline = AbortSignal.timeout(TIMEOUT_MS);
  const stop =
    signal === undefined ? deadline : AbortSignal.any([signal, deadline]);

  /*
   * `streamText` with an `Output.object`, not `streamObject`.
   *
   * `streamObject` is what a from-memory version of this call would use, and
   * it still exists — but it is deprecated in the installed SDK, and the lint
   * rule that reads `@deprecated` annotations is what said so before anything
   * shipped. Structured output is a property of an ordinary generation rather
   * than a separate function, streaming or not.
   */
  const { partialOutputStream, output } = streamText({
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
              "Suggest a title, a description and one or two possible " +
              "places for this photograph." +
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
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    abortSignal: stop,
    /*
     * The full error, once, where it is useful. Without this callback a
     * provider failure is only observable as a rejected promise somewhere
     * downstream, by which point the vendor's own message — the one naming
     * which model refused and why — has been replaced by ours.
     */
    onError({ error }) {
      console.error("The model could not suggest details:", error);
    },
  });

  /*
   * The one thing that could take the server down with it.
   *
   * `output` is a getter that builds a *derived* promise on every access —
   * `finalStep.then(…)` — and the SDK marks only its own internal `_steps`
   * promise as handled, never this chain. So the moment `streamText` is
   * called there is a live promise nobody has attached a handler to, and any
   * failure that stops the caller from reaching `await run.complete` — the
   * timeout firing mid-stream, the reader disconnecting, a provider dying —
   * surfaces as an `unhandledRejection`. Under Node's default that is fatal
   * to the process, which on Fluid Compute means killing every other request
   * sharing the instance: a failed suggestion for one photographer taking out
   * an upload for another.
   *
   * Attaching an empty catch marks it handled without consuming it — the
   * caller still awaits the same promise and still sees the same rejection.
   */
  const complete = output;
  Promise.resolve(complete).catch(() => {
    /* Reported by `onError`, and again by whoever awaits `complete`. */
  });

  return { parts: partialOutputStream, complete };
}
