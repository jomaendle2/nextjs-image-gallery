import { type NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/auth/session";
import { consumeLoginToken, pruneLoginTokens } from "@/lib/auth/tokens";

/**
 * Consumes a magic link.
 *
 * Every failure — unknown token, expired, already used, or an address that
 * holds no capability at all — lands on the same `?error=expired`.
 * Distinguishing them would tell an attacker holding a guessed token whether
 * it ever existed.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const redeemed = await consumeLoginToken(token);

  if (!redeemed) {
    return NextResponse.redirect(
      new URL("/contribute?error=expired", request.url),
    );
  }

  await createSession(redeemed.email, redeemed.contributor?.id ?? null);

  // Cheap housekeeping on a path that runs rarely, rather than a cron job.
  await pruneLoginTokens();

  /*
   * Somebody with no contributors row has nothing to do on the contributor
   * dashboard — it would refuse them the moment they arrived. A member is
   * sent to the gallery, which is what they signed in to see.
   */
  return NextResponse.redirect(
    new URL(
      redeemed.contributor === null ? "/" : "/contribute/photos",
      request.url,
    ),
  );
}
