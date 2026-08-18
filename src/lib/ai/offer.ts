import process from "node:process";

/**
 * Whether a model can be asked to look at a photograph at all.
 *
 * Two environment variables and a `Boolean`. No SDK is imported, no model is
 * constructed, no network call is made — and that is the entire reason this
 * file exists rather than an export beside the call itself.
 *
 * It is the rule `src/lib/members/offer.ts` was written for, applied a second
 * time: a module that merely asks whether a thing is configured must not have
 * to load it. `ai` and its gateway provider are the same shape of dependency
 * `stripe` was — Next traces imports to decide what ships beside a route, so
 * a button on the upload page asking "is this switched on" would otherwise
 * drag the whole client into the trace of every route that renders it.
 *
 * **Absent, and visibly so.** No credentials is not a broken deploy; it is a
 * gallery whose photographers write their own titles, which is how every
 * photograph on this site got its title until now. So this returns `false`,
 * the button is not rendered, and nothing throws — the argument
 * `src/lib/maptiler.ts` makes about the map key, including its conclusion
 * that such a variable must not go into `scripts/preflight.mts`.
 *
 * Server-only names, deliberately not `NEXT_PUBLIC_`: a `NEXT_PUBLIC_`
 * variable is inlined into every client bundle by the compiler, and a gateway
 * key is a spending credential.
 *
 * The two names are the two ways the AI SDK's gateway authenticates, in the
 * order it tries them — verified in
 * `node_modules/@ai-sdk/gateway`, not from memory. `AI_GATEWAY_API_KEY` is an
 * explicit key; `VERCEL_OIDC_TOKEN` is the short-lived token a Vercel
 * deployment is given automatically, and the one `vercel env pull` writes for
 * local development.
 *
 * One known false negative, and it fails the safe way. On Vercel the OIDC
 * token can arrive as a request header (`x-vercel-oidc-token`) rather than in
 * the environment; where it does, this reports "not configured" and the
 * feature stays hidden even though a call would have succeeded. Hiding a
 * working feature is recoverable by setting `AI_GATEWAY_API_KEY`; offering a
 * button that answers with an error is not.
 */
/**
 * Whether an OIDC token is still worth presenting to the gateway.
 *
 * The presence check this file used to make was the bug it was written to
 * prevent. `vercel env pull` writes a `VERCEL_OIDC_TOKEN` that lasts about
 * twelve hours and leaves it in `.env.local` for ever; two days later the
 * variable is still set, `Boolean(...)` still says yes, and the button is
 * still rendered — and every press of it spends a round trip to arrive at
 * "the suggestion could not be made just now". That is precisely the failure
 * this module's own comment calls unrecoverable: offering a control that
 * cannot work.
 *
 * The token is a JWT and says when it stops being one, so it is asked.
 * Sixty seconds of margin, because a token that expires while the request is
 * in flight fails the same way an expired one does.
 *
 * Anything that will not decode is treated as unusable rather than given the
 * benefit of the doubt, following the same rule in the same direction: a
 * false negative hides a working feature and is fixed by setting
 * `AI_GATEWAY_API_KEY`, and a false positive is a button that answers with an
 * error.
 */
function oidcStillValid(token: string): boolean {
  const [, payload] = token.split(".");
  if (payload === undefined) {
    return false;
  }

  try {
    const { exp } = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { exp?: unknown };

    return typeof exp === "number" && exp * 1000 > Date.now() + 60_000;
  } catch {
    return false;
  }
}

export function aiSuggestionsConfigured(): boolean {
  if (process.env["AI_GATEWAY_API_KEY"]) {
    return true;
  }

  const oidc = process.env["VERCEL_OIDC_TOKEN"];
  return oidc !== undefined && oidc !== "" && oidcStillValid(oidc);
}
