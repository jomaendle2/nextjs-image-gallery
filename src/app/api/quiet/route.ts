import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { muteNudges } from "@/lib/auth/contributors";

/**
 * The one-click unsubscribe endpoint, for mail clients rather than people.
 *
 * This is the URL in the `List-Unsubscribe` header of every nudge, and RFC
 * 8058 defines exactly what it must be: something a client can POST to,
 * unauthenticated, with no body worth reading, answering 200. Gmail's
 * "unsubscribe" button calls this. The alternative to it working is the
 * reader pressing "report spam" instead, which costs the whole domain rather
 * than one address.
 *
 * **POST only, and there is deliberately no GET.** Corporate link scanners —
 * SafeLinks, Proofpoint, Barracuda — fetch every URL in an inbound message
 * before the recipient sees it. A GET that muted would silence entire
 * organisations before anyone had read the mail, and they would never find
 * out why the gallery had gone quiet. Scanners do not POST. The human-facing
 * page at `/contribute/quiet` is the same rule with a button on it.
 *
 * The answer is 200 whether or not the token matched anything. A 404 for an
 * unknown token would turn this into a way to test tokens, and there is
 * nothing the caller could usefully do with the difference: from a mail
 * client's point of view "you will not be mailed again" is true either way.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const muted = await muteNudges(token);

  if (!muted) {
    // Worth knowing about — a header pointing at a token nothing matches
    // means the mint or the URL is wrong, and every reader of that message
    // has a dead opt-out.
    console.warn("One-click unsubscribe: no contributor matched the token.");
  }

  return NextResponse.json({ ok: true });
}
