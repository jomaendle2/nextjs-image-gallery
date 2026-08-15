import { type NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/auth/session";
import { consumeLoginToken, pruneLoginTokens } from "@/lib/auth/tokens";

/**
 * Consumes a magic link.
 *
 * Every failure — unknown token, expired, already used, revoked contributor —
 * lands on the same `?error=expired`. Distinguishing them would tell an
 * attacker holding a guessed token whether it ever existed.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const contributor = await consumeLoginToken(token);

  if (!contributor) {
    return NextResponse.redirect(
      new URL("/contribute?error=expired", request.url),
    );
  }

  await createSession(contributor.id);

  // Cheap housekeeping on a path that runs rarely, rather than a cron job.
  await pruneLoginTokens();

  return NextResponse.redirect(new URL("/contribute/photos", request.url));
}
