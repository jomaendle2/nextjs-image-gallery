import { del, put } from "@vercel/blob";
import { type NextRequest, NextResponse } from "next/server";
import { getCurrentContributor } from "@/lib/auth/session";
import { isOurBlob } from "@/lib/blob-host";
import { deriveFromBuffer } from "@/lib/photos/derive";
import { blobIsClaimed, insertDraftPhoto } from "@/lib/photos/repository";

/** Matches the token constraint in /api/uploads/token. */
const MAX_BYTES = 25 * 1024 * 1024;

const LEADING_SLASH = /^\//;

interface DraftRequest {
  blobUrl?: unknown;
}

/**
 * An error whose message is meant for the person uploading.
 *
 * Everything else — a failed fetch, a sharp decode, a storage timeout — is
 * logged in full and replaced with a sentence somebody can act on. The
 * distinction has to be explicit, because `error.message` cannot tell the
 * difference between a sentence we wrote and one libvips did.
 */
class TellTheUser extends Error {}

/**
 * What the photographer is told when the fault is ours. Never a stack.
 *
 * There was no such sentence before. Every non-`TellTheUser` throw in here —
 * a storage timeout, a Neon hiccup, our own bug — was answered with "that
 * file could not be read as an image. It may be damaged", which blames a
 * person's photograph for our outage: they look at a file they know is fine
 * and the site tells them it is broken. Which stage failed is the only thing
 * that decides between the two sentences, so the stages are separated below.
 */
const OUR_FAULT_MESSAGE =
  "Something went wrong on our side. Try that one again.";

/**
 * Removes uploads that no row will ever point at.
 *
 * Takes every blob written during this request rather than just the original,
 * because there are two of them once the display copy exists. Failures are
 * logged and swallowed: the request has already failed, and a blob we could
 * not delete is a smaller problem than the one we are answering.
 */
async function discard(...urls: (string | undefined)[]): Promise<void> {
  await Promise.all(
    urls
      .filter((url): url is string => url !== undefined)
      .map((url) =>
        del(url).catch((cleanupError: unknown) => {
          console.error("Could not remove the orphaned blob:", cleanupError);
        }),
      ),
  );
}

/**
 * The uploaded bytes, or a throw the caller can classify.
 *
 * Its own function so `POST` stays readable — the three stages each want a
 * `try` with a different answer, and inlining all of them put one handler over
 * the complexity limit.
 *
 * Throws `TellTheUser` only for the size refusal, which is the single thing
 * here that is about the photographer's file rather than our storage.
 */
async function readUpload(url: URL): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not read the upload back (${response.status}).`);
  }

  /*
   * Refuse on the declared length before reading a byte of the body.
   *
   * The check on `buffer.byteLength` in stage two is the one that decides, and
   * it has to stay — a `Content-Length` is a claim, not a fact. But it is a
   * claim our own store makes about a blob it is serving, and believing it
   * early is what stops a request holding a multi-gigabyte body in memory to
   * find out it is too big. The exploitable version of this is already closed
   * upstream, where the host pin means only our store can be read back at all;
   * this is the part that was simply wasteful.
   */
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BYTES) {
    throw new TellTheUser("That file is larger than 25 MB.");
  }

  return Buffer.from(await response.arrayBuffer());
}

/**
 * Turns a freshly uploaded blob into a draft row.
 *
 * Fetches the file once, derives everything the gallery needs from it, and
 * inserts an unpublished row. Written as three stages because they fail
 * differently: reading the blob back is ours, decoding it is a question
 * about the photographer's file, and writing the display copy and the row is
 * ours again. One `try` around all three could not tell them apart, and so
 * it told everybody the same untrue thing.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const contributor = await getCurrentContributor();
  if (!contributor) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { blobUrl } = (await request.json()) as DraftRequest;
  if (typeof blobUrl !== "string") {
    return NextResponse.json({ error: "Missing blob url." }, { status: 400 });
  }

  /*
   * The client supplies this URL, so it is treated as untrusted input: only
   * our own Blob host under photos/ is fetched. Without this the endpoint
   * would fetch any URL a signed-in user named, which is a server-side
   * request forgery hole.
   */
  let parsed: URL;
  try {
    parsed = new URL(blobUrl);
  } catch {
    return NextResponse.json({ error: "Malformed blob url." }, { status: 400 });
  }
  /*
   * The exact store, not any store on the platform. This used to match on the
   * hostname *suffix*, which every free Vercel Blob bucket shares — so a
   * contributor could point a published row at a bucket they own and change
   * what it serves after review. `isOurBlob` is the one definition; see
   * `src/lib/blob-host.ts` for the argument.
   */
  if (!isOurBlob(blobUrl)) {
    return NextResponse.json(
      { error: "Unexpected blob url." },
      { status: 400 },
    );
  }

  /*
   * Derived from the URL we just validated rather than taken from the request
   * body. The stored pathname is what `del()` is given when a photo is later
   * deleted, so accepting the client's version would let one contributor name
   * another photo's blob and have it removed on their behalf.
   */
  const pathname = parsed.pathname.replace(LEADING_SLASH, "");

  /*
   * Being on our Blob host proves where the file came from, not whose it is.
   * Every published photograph's blob URL appears in the markup of the page
   * that shows it, so without this a signed-in contributor could post
   * another photographer's URL here and be handed a draft row attributed to
   * themselves — someone else's photograph, ready to publish under their own
   * name, from a URL they were simply shown.
   *
   * Deliberately not a 404-style silent refusal: the person doing this by
   * accident (re-submitting a URL, a double-click) deserves to know why.
   *
   * This has to stay ahead of the stages below. Every one of their `catch`
   * blocks deletes the upload, which is right for a file that has just been
   * made and wrong in every way for one that already belongs to somebody —
   * moving this check inside them would turn a refusal to steal a photograph
   * into a way to delete one.
   */
  if (await blobIsClaimed(pathname)) {
    return NextResponse.json(
      { error: "That upload already belongs to a photograph." },
      { status: 409 },
    );
  }

  /*
   * Stage one: read back what the client just uploaded. The bytes have not
   * been looked at yet, so a failure here says nothing about the file — we
   * wrote this blob seconds ago and cannot read it, which is ours.
   */
  let buffer: Buffer;
  try {
    buffer = await readUpload(parsed);
  } catch (error) {
    // No row was written, so the blob would be unreachable forever.
    await discard(blobUrl);

    /*
     * The size refusal is the photographer's to know about, and it is the one
     * thing in this stage that is about their file rather than our storage —
     * so it keeps its own sentence and its own status.
     */
    if (error instanceof TellTheUser) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("Could not read the upload back:", error);
    return NextResponse.json({ error: OUR_FAULT_MESSAGE }, { status: 500 });
  }

  /*
   * Stage two: decode. This is the one stage entitled to blame the file,
   * because it is the only one that has looked at it — a RAW renamed to
   * .jpg, a truncated transfer, a format libvips will not open.
   */
  let derived: Awaited<ReturnType<typeof deriveFromBuffer>>;
  try {
    if (buffer.byteLength > MAX_BYTES) {
      throw new TellTheUser("That file is larger than 25 MB.");
    }
    derived = await deriveFromBuffer(buffer);
  } catch (error) {
    await discard(blobUrl);
    console.error("Could not read the upload as an image:", error);

    /*
     * Only messages written for a person reach a person.
     *
     * This returned `error.message` for anything that was an Error, which
     * meant a photographer who uploaded a damaged file was shown
     * "vipspng: libpng read error" — a C library's internal complaint,
     * beside their own filename. It says nothing they can act on and names
     * software they did not know was involved. The full error is still
     * logged above, which is where it is useful.
     */
    return NextResponse.json(
      {
        error:
          error instanceof TellTheUser
            ? error.message
            : "That file could not be read as an image. It may be damaged, or saved in a format the camera wrote unusually.",
      },
      { status: 422 },
    );
  }

  /*
   * Stage three: write. The photograph decoded, so nothing from here on is
   * the photographer's fault, and nothing from here on may tell them it was.
   */
  let display: Awaited<ReturnType<typeof put>> | undefined;
  try {
    /*
     * The original stays exactly as uploaded; this is the copy the gallery
     * renders from. Serving 13 MB originals through the image optimizer made
     * concurrent thumbnail requests time out.
     */
    display = await put(
      `photos/display/${pathname.split("/").pop()}`,
      derived.display,
      {
        access: "public",
        addRandomSuffix: true,
        contentType: "image/jpeg",
      },
    );

    const id = await insertDraftPhoto({
      blob_url: blobUrl,
      blob_pathname: pathname,
      display_url: display.url,
      display_pathname: display.pathname,
      width: derived.width,
      height: derived.height,
      blur_data_url: derived.blur_data_url,
      bg_color: derived.bg_color,
      exif: derived.exif,
      author_id: contributor.id,
    });

    /*
     * The id, and nothing else.
     *
     * This spread `derived`, which carries `display: Buffer` — the whole
     * re-encoded JPEG. `JSON.stringify` turns a Buffer into
     * `{"type":"Buffer","data":[…]}`, so a 2 MB image left here as roughly
     * 8 MB of comma-separated integers, on every upload. Past Vercel's
     * response limit that surfaces to the photographer as "that upload could
     * not be read" *after* the row and both blobs are already committed — a
     * failure message for something that succeeded. The client has never
     * read anything but the error branch.
     */
    return NextResponse.json({ id });
  } catch (error) {
    /*
     * Both copies, not just the original.
     *
     * The old single `del(blobUrl)` ran here too, and by this point there is
     * a second blob: the re-encoded display JPEG, written a few lines above.
     * A failed insert left it in the store with no row pointing at it and no
     * way to find it again — several megabytes per failure, accumulating
     * silently and billed monthly. `deletePhoto` in `repository.ts` was
     * fixed for exactly this leak on the deletion path; this was the same
     * leak on the ingest path.
     *
     * Both go even though the fault is ours and the original is still
     * perfectly good, because keeping it would only move the leak: the
     * client holds no reference it can resubmit — `UploadForm` retries by
     * uploading the file from disk again, which mints a fresh blob — so a
     * kept original is an orphan under a different name. The photographer
     * still re-uploads either way; this way we do not pay to store the
     * evidence of our own outage.
     */
    await discard(blobUrl, display?.url);

    console.error("Draft creation failed after decoding:", error);

    return NextResponse.json({ error: OUR_FAULT_MESSAGE }, { status: 500 });
  }
}
