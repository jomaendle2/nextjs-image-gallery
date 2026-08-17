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
 * Turns a freshly uploaded blob into a draft row.
 *
 * Fetches the file once, derives everything the gallery needs from it, and
 * inserts an unpublished row. If derivation fails the blob is deleted before
 * the error is returned, so a rejected upload leaves nothing behind.
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
   * This has to stay outside the `try` below. That block's `catch` deletes
   * the blob on failure, which is right for an upload that has just been
   * made and wrong in every way for one that already belongs to somebody —
   * moving this check inside it would turn a refusal to steal a photograph
   * into a way to delete one.
   */
  if (await blobIsClaimed(pathname)) {
    return NextResponse.json(
      { error: "That upload already belongs to a photograph." },
      { status: 409 },
    );
  }

  try {
    const response = await fetch(parsed);
    if (!response.ok) {
      throw new Error(`Could not read the upload back (${response.status}).`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) {
      throw new TellTheUser("That file is larger than 25 MB.");
    }

    const derived = await deriveFromBuffer(buffer);

    /*
     * The original stays exactly as uploaded; this is the copy the gallery
     * renders from. Serving 13 MB originals through the image optimizer made
     * concurrent thumbnail requests time out.
     */
    const display = await put(
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
    // No row was written, so the blob would be unreachable forever.
    await del(blobUrl).catch((cleanupError: unknown) => {
      console.error("Could not remove the orphaned blob:", cleanupError);
    });

    console.error("Draft creation failed:", error);

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
}
