import { type NextRequest, NextResponse } from "next/server";
import { aiSuggestionsConfigured } from "@/lib/ai/offer";
import { encodeRecord, NDJSON, OUR_FAULT_MESSAGE } from "@/lib/ai/stream";
import {
  type SuggestionRun,
  type SuggestionSource,
  suggestForPhotograph,
} from "@/lib/ai/suggest";
import {
  type PartialRawSuggestion,
  salvage,
  shapePartial,
  shapeSuggestion,
} from "@/lib/ai/suggestion";
import { getCurrentContributor } from "@/lib/auth/session";
import { isOurBlob } from "@/lib/blob-host";
import type { PhotoExif } from "@/lib/photos/derive";
import { getOwnPhotoSource } from "@/lib/photos/repository";
import { suggestLimiter } from "@/lib/rate-limit";

/**
 * A title, a description and a place, proposed by a model that has looked at
 * the photograph.
 *
 * A POST that writes nothing. Nothing here reaches the database: the answer
 * goes back to the form, the photographer reads it, changes what they
 * disagree with, and the existing server action saves it under its own caps
 * and its own authorization. A suggestion is a draft of a sentence — treating
 * it as a fact about somebody's photograph is precisely the failure this
 * whole route is arranged to avoid.
 *
 * POST rather than GET for the reason I1 gives about single-use tokens: a
 * mail gateway, a prefetch or a crawler follows a GET, and this one spends
 * money at a third party each time it is followed.
 */

/**
 * The display copy is a `sharp` re-encode capped at 3840px; a few megabytes
 * is a large one. The ceiling exists so a corrupt row cannot make us hold an
 * unbounded body in memory on the way to a provider that charges by the
 * token, not because any real photograph approaches it.
 */
const MAX_BYTES = 12 * 1024 * 1024;

/*
 * The apology itself lives in `stream.ts`, so both sides of the first byte
 * say the same thing. Why this route has only *one* kind of failure message —
 * and no `TellTheUser` class like `/api/photos/draft` — is the part worth
 * keeping here: every way a model call can fail is ours and none of it is
 * actionable by the person waiting, so the whole `catch` is the replacement,
 * the vendor's text goes to the log, and the refusals a photographer *can*
 * act on are answered above without an exception being involved at all.
 */

/**
 * The display copy's bytes.
 *
 * The URL comes from our own database rather than from the request, and is
 * still checked against `isOurBlob` before it is fetched. That is not
 * belt-and-braces: it is the same guard `/api/photos/draft` and `/api/og`
 * needed, and the argument in `src/lib/blob-host.ts` is that a URL which
 * decides what a server fetches gets checked wherever it is used, because the
 * next edit that widens where these strings come from will not come back here
 * to add it.
 *
 * The *display* copy specifically, never the original. The original still
 * carries whatever the camera wrote, GPS included; the re-encode carries no
 * metadata at all. That is the whole reason this route reads one column
 * rather than the usual coalesce of two.
 */
async function readDisplayCopy(url: string): Promise<Uint8Array> {
  if (!isOurBlob(url)) {
    throw new Error(`Refusing to fetch a photograph from ${url}.`);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not read the display copy (${response.status}).`);
  }

  // Believe the declared length early, then check the real one. Our own store
  // is making the claim, and the point is not to buffer a body to find out.
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BYTES) {
    throw new Error(`Display copy is too large to send (${declared} bytes).`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) {
    throw new Error(`Display copy is too large to send (${bytes.byteLength}).`);
  }
  return bytes;
}

/**
 * Either the refusal to send back, or the photograph to look at.
 *
 * One or the other, so the handler cannot forget to check and cannot read the
 * row twice to get around the check.
 */
type Gate =
  | { refusal: NextResponse; source?: undefined }
  | {
      refusal?: undefined;
      source: {
        url: string;
        exif: PhotoExif | null;
        location: string | null;
      };
    };

/**
 * Everything before the model call, which is the half that can answer for
 * itself.
 *
 * Its own function so the handler stays under the complexity limit and so the
 * order stays visible: who is asking, whether the feature exists at all,
 * whether they have asked too often, and only then which photograph. The
 * limiter deliberately sits *after* the configuration check — counting
 * attempts against a feature that is switched off would rate-limit a person
 * out of an error message.
 */
async function gate(id: string): Promise<Gate> {
  const contributor = await getCurrentContributor();
  if (!contributor) {
    return {
      refusal: NextResponse.json({ error: "Not signed in." }, { status: 401 }),
    };
  }

  /*
   * Absent, and visibly so. A gallery with no gateway credentials is a
   * gallery whose photographers write their own titles, which is how every
   * photograph here got one until now — so this is a plain sentence and a
   * 503, not a 500 and not a stack. The button that calls this is not
   * rendered when `aiSuggestionsConfigured()` is false; this is what answers
   * the request that arrives anyway.
   */
  if (!aiSuggestionsConfigured()) {
    return {
      refusal: NextResponse.json(
        { error: "Suggestions are not switched on for this gallery." },
        { status: 503 },
      ),
    };
  }

  if (!suggestLimiter.check(contributor.id)) {
    return {
      refusal: NextResponse.json(
        { error: "That is a lot of suggestions. Try again shortly." },
        { status: 429 },
      ),
    };
  }

  const source = await getOwnPhotoSource(id, contributor.id);
  if (source === null) {
    return {
      refusal: NextResponse.json(
        { error: "No such photograph." },
        { status: 404 },
      ),
    };
  }
  if (source.display_url === null) {
    return {
      refusal: NextResponse.json(
        { error: "There is nothing to look at for this photograph yet." },
        { status: 422 },
      ),
    };
  }

  return {
    source: {
      url: source.display_url,
      exif: source.exif,
      location: source.location,
    },
  };
}

/** Put one record on the wire; false once there is nobody to put it on. */
type Say = (record: Parameters<typeof encodeRecord>[0]) => boolean;

/**
 * The run, drained onto the wire, ending in exactly one terminal record.
 *
 * Its own function rather than the body of `start`, because the stream also
 * has to deal with a reader that leaves and a controller that will not take
 * any more — and mixing "what the model said" with "who is still listening"
 * in one block is what pushed the original past the complexity limit.
 *
 * It does not rethrow. Every failure a model call has is answered here, as a
 * record, because by this point the 200 has already gone out.
 */
async function pump(
  run: SuggestionRun,
  say: Say,
  dead: AbortSignal,
): Promise<void> {
  /*
   * The best thing the model has said so far, kept so that a run which wrote
   * a good title and description and then failed does not throw them away.
   */
  let latest: PartialRawSuggestion | null = null;

  try {
    for await (const part of run.parts) {
      latest = part;
      if (!say({ type: "partial", value: shapePartial(part) })) {
        return;
      }
    }
    say({ type: "done", value: shapeSuggestion(await run.complete) });
  } catch (error) {
    if (dead.aborted) {
      /* They left. Nothing to report, and nobody to report it to. */
      return;
    }

    console.error("Could not suggest details for a photograph:", error);

    /*
     * A finished sentence beats an apology.
     *
     * The final object can fail while the useful part of the answer has
     * already arrived — validation rejects a malformed `places` entry, the
     * stream truncates after the description, the deadline lands during the
     * last field. Every one of those used to be answered with "could not be
     * made just now", putting the form back and discarding a title and
     * description the photographer had just watched being written. The words
     * they see are the same; this only changes whether they keep them.
     */
    const rescued = salvage(latest);
    if (rescued === null) {
      say({ type: "error", message: OUR_FAULT_MESSAGE });
    } else {
      say({ type: "done", value: rescued, salvaged: true });
    }
  }
}

/**
 * The model's answer, turned into lines, with the failure written into the
 * body rather than the status.
 *
 * Everything past the first byte is a 200 whatever happens. A stream's
 * headers leave before its content does, so once the response has begun there
 * is no status code left to change — a provider that dies in the middle of a
 * sentence can only be reported as a record. That is why `error` exists in
 * the wire format at all, and why the refusals a photographer can act on are
 * all answered before this function is reached.
 *
 * The full error is logged here and never sent. A provider's text names
 * software they did not know was involved, sometimes quotes the prompt back,
 * and says nothing they can act on — the same lesson as "vipspng: libpng read
 * error" beside somebody's own filename.
 */
function suggestionLines(
  source: SuggestionSource,
  requestSignal: AbortSignal,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  /*
   * Both ways this can end early, composed once.
   *
   * `quit` is ours, fired by `cancel` and by a failed enqueue — the platform
   * does not always abort the request signal when a reader simply goes away.
   * `AbortSignal.any` unions the two and drops its listeners when it settles,
   * which is why there is no `addEventListener`/`removeEventListener` pair to
   * keep balanced here; `suggestForPhotograph` composes its timeout onto this
   * the same way, one file over.
   *
   * One signal rather than two also removes a real bug: `say` used to test
   * our controller while `pump` tested the request's, so a reader cancelling
   * left `pump` believing somebody was still listening — logging an error and
   * trying to write an apology onto a closed stream for what is an ordinary
   * abandoned request.
   */
  const quit = new AbortController();
  const stop = () => {
    quit.abort();
  };
  const dead = AbortSignal.any([requestSignal, quit.signal]);

  const run = suggestForPhotograph(source, dead);

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      /*
       * Writing to a stream nobody is reading is not an error worth throwing.
       *
       * Once a reader disconnects, `enqueue` throws `TypeError: Invalid
       * state` — and that used to happen *inside* the try below, so the catch
       * ran, called `say` again for the error record, threw a second time out
       * of the catch, and then `controller.close()` in the finally threw a
       * third. One person closing a tab produced an exception escaping
       * `start()` rather than a tidy end.
       */
      const say: Say = (record) => {
        if (dead.aborted) {
          return false;
        }
        try {
          controller.enqueue(encoder.encode(encodeRecord(record)));
          return true;
        } catch {
          stop();
          return false;
        }
      };

      try {
        await pump(run, say, dead);
      } finally {
        try {
          controller.close();
        } catch {
          /* Already closed by the reader going away. */
        }
      }
    },

    /*
     * The reader went away. Stop the model rather than paying for an answer
     * nobody will see — a generation runs to completion regardless of whether
     * anyone is still listening, and is billed for every token.
     */
    cancel() {
      stop();
    },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const { refusal, source } = await gate(id);
  if (refusal !== undefined) {
    return refusal;
  }

  /*
   * Reading the photograph still happens before the response begins, so its
   * failure is still a status code. It is the one thing in here that can go
   * wrong while a proper answer is still possible.
   */
  let image: Uint8Array;
  try {
    image = await readDisplayCopy(source.url);
  } catch (error) {
    console.error("Could not read a photograph to suggest details:", error);
    return NextResponse.json({ error: OUR_FAULT_MESSAGE }, { status: 502 });
  }

  /*
   * Never stored between here and the person who asked. A suggestion is
   * about one photograph and one photographer, and it is not a fact — a
   * cache of it is a wrong answer waiting to be served to somebody else.
   *
   * `no-transform` is the addition streaming needs: without it a proxy is
   * entitled to buffer and re-compress the body, which would hold every line
   * until the last one and deliver the whole point of this route as a single
   * chunk at the end.
   */
  /*
   * No body is read. The request used to carry a photographer's hint — a few
   * typed words and an optionally pointed-at area — which was the one path
   * from a request body to a prompt, guarded by its own rounding invariant.
   * The feature confused its first real user (a second location-ish input on
   * a form that already had one) and is gone; with it went the only reason
   * this route ever parsed input. The photograph and its stored EXIF are the
   * whole prompt now, and both come from the database, not the caller.
   */
  return new NextResponse(
    suggestionLines(
      { image, exif: source.exif, location: source.location },
      request.signal,
    ),
    {
      headers: {
        "Cache-Control": "private, no-store, no-transform",
        "Content-Type": NDJSON,
        "X-Accel-Buffering": "no",
      },
    },
  );
}
