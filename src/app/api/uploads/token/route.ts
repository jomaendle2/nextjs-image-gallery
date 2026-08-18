import { type HandleUploadBody, handleUpload } from "@vercel/blob/client";
import { type NextRequest, NextResponse } from "next/server";
import { getCurrentContributor } from "@/lib/auth/session";

/** Photographers upload big originals; 25 MB covers a full-frame JPEG. */
const MAX_BYTES = 25 * 1024 * 1024;

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/**
 * Issues a short-lived token so the browser can upload straight to Blob.
 *
 * The file never passes through a function: a 25 MB original would otherwise
 * be buffered server-side for no reason. The constraints below are enforced
 * by Blob itself, because they are baked into the signed token rather than
 * checked by code the client could skip.
 *
 * `onUploadCompleted` is deliberately not used. It never fires against
 * localhost, so the whole ingest path would be untestable in development;
 * the client posts to /api/photos/draft instead.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const contributor = await getCurrentContributor();
        if (!contributor) {
          throw new Error("Not signed in.");
        }
        return {
          allowedContentTypes: ALLOWED,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          // Read back in the draft route to attribute the photo, so a client
          // cannot claim to be someone else by posting a different author id.
          tokenPayload: contributor.id,
        };
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Upload token request failed:", error);
    return NextResponse.json({ error: "Upload not allowed." }, { status: 401 });
  }
}
