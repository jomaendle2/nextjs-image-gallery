import type { Instrumentation } from "next";

/**
 * Every server error, on one line, with enough context to find it again.
 *
 * **The gap this fills is that nothing was watching.** There is no error
 * tracker, no alerting and no CI in this repo; Plausible counts pageviews
 * from the browser and Speed Insights measures web vitals, and neither of
 * them knows what a 500 is. So a route that threw, an email that never sent
 * and a query that quietly returned nothing all looked identical from
 * outside: a site that seemed fine.
 *
 * This does not fix that. It makes it fixable. `onRequestError` fires for
 * every error the server captures — in a route handler, a server action, or
 * a Server Component render — and one structured line per error is the thing
 * a log drain can match on and alert from. Wiring that drain, or a real
 * tracker, is a dashboard job; the hook it needs is here.
 *
 * **Deliberately no network call.** The documented shape of this function
 * `await`s a POST to a provider, and that is right once there is a provider.
 * Adding one now would mean a second thing that can fail inside the handler
 * for the first thing that failed, plus a secret to hold and an egress bill,
 * to reach nowhere. `console.error` on Vercel already goes to the log
 * stream; the drain reads it from there.
 *
 * One line, JSON, so it survives grep and a drain's parser equally. Anything
 * spread across lines gets interleaved with other requests under
 * concurrency, which is precisely when the errors show up.
 */
export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context,
) => {
  const message = error instanceof Error ? error.message : String(error);

  /*
   * React can replace the thrown error with its own during a Server
   * Component render, and the original is then only identifiable by digest —
   * which is also the string the reader sees on the error page, so it is the
   * one value that ties a bug report to this line.
   */
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String((error as { digest: unknown }).digest)
      : undefined;

  console.error(
    JSON.stringify({
      at: "server-error",
      message,
      digest,
      stack: error instanceof Error ? error.stack : undefined,
      /*
       * The path, never the query string. A path says which route broke; a
       * query string on this site can carry an unsubscribe token, a magic
       * link secret or a Stripe session id, and a log drain is the last place
       * any of those should end up. `headers` is left out for the same
       * reason — it carries the session cookie.
       */
      path: request.path,
      method: request.method,
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
      revalidateReason: context.revalidateReason,
    }),
  );
};
