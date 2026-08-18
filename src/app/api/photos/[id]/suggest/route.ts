import { type NextRequest, NextResponse } from "next/server";
import { aiSuggestionsConfigured } from "@/lib/ai/offer";
import { suggestForPhotograph } from "@/lib/ai/suggest";
import { shapeSuggestion } from "@/lib/ai/suggestion";
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

/**
 * One sentence for every failure past this point, and no `TellTheUser` class
 * beside it.
 *
 * `src/app/api/photos/draft/route.ts` needs that class because one of its
 * failures — "that file is larger than 25 MB" — is about the photographer's
 * own file and is theirs to act on, while the rest are ours. The discipline
 * is that only sentences written for a person reach one; the class is how
 * that route tells the two apart when it has both kinds.
 *
 * This route has one kind. Every way the model call can fail — a provider
 * outage, a refusal, a timeout, a schema the model would not fill in, a
 * display copy we cannot read back — is ours and none of it is actionable by
 * the person waiting. So the whole `catch` is the replacement, the vendor's
 * text goes to the log, and the refusals a photographer *can* do something
 * about (not signed in, not their photograph, too many requests) are answered
 * above without an exception being involved at all.
 */
const OUR_FAULT_MESSAGE =
  "The suggestion could not be made just now. Try again in a moment, or " +
  "write it yourself — nothing has been changed either way.";

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
  | { refusal?: undefined; source: { url: string; exif: PhotoExif | null } };

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

  return { source: { url: source.display_url, exif: source.exif } };
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const { refusal, source } = await gate(id);
  if (refusal !== undefined) {
    return refusal;
  }

  try {
    const image = await readDisplayCopy(source.url);
    const suggestion = shapeSuggestion(
      await suggestForPhotograph({ image, exif: source.exif }),
    );
    /*
     * Never stored between here and the person who asked. A suggestion is
     * about one photograph and one photographer, and it is not a fact — a
     * cache of it is a wrong answer waiting to be served to somebody else.
     */
    return NextResponse.json(suggestion, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    /*
     * A provider's error text never reaches a photographer. It names software
     * they did not know was involved, sometimes quotes the prompt back, and
     * says nothing they can act on — the same lesson as "vipspng: libpng read
     * error" beside somebody's own filename. The full error is logged here,
     * which is where it is useful.
     */
    console.error("Could not suggest details for a photograph:", error);
    return NextResponse.json({ error: OUR_FAULT_MESSAGE }, { status: 502 });
  }
}
