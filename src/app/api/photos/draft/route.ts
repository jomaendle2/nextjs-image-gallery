import { del, put } from "@vercel/blob";
import { type NextRequest, NextResponse } from "next/server";
import { getCurrentContributor } from "@/lib/auth/session";
import { deriveFromBuffer } from "@/lib/photos/derive";
import { insertDraftPhoto } from "@/lib/photos/repository";

/** Matches the token constraint in /api/uploads/token. */
const MAX_BYTES = 25 * 1024 * 1024;

const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

const LEADING_SLASH = /^\//;

interface DraftRequest {
  blobUrl?: unknown;
}

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
  if (
    parsed.protocol !== "https:" ||
    !parsed.hostname.endsWith(BLOB_HOST_SUFFIX) ||
    !parsed.pathname.startsWith("/photos/")
  ) {
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

  try {
    const response = await fetch(parsed);
    if (!response.ok) {
      throw new Error(`Could not read the upload back (${response.status}).`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) {
      throw new Error("That file is larger than 25 MB.");
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
      width: derived.width,
      height: derived.height,
      blur_data_url: derived.blur_data_url,
      bg_color: derived.bg_color,
      exif: derived.exif,
      author_id: contributor.id,
    });

    return NextResponse.json({ id, ...derived });
  } catch (error) {
    // No row was written, so the blob would be unreachable forever.
    await del(blobUrl).catch((cleanupError: unknown) => {
      console.error("Could not remove the orphaned blob:", cleanupError);
    });

    console.error("Draft creation failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "That file could not be read as an image.",
      },
      { status: 422 },
    );
  }
}
