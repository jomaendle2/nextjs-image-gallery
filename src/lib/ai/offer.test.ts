import { afterEach, describe, expect, it, vi } from "vitest";
import { aiSuggestionsConfigured } from "./offer";

/**
 * The probe, and the case that matters most: no credentials at all.
 *
 * A gallery with no gateway key is the ordinary state of a fresh clone and of
 * anybody's local checkout, and the promise is that it is a feature which is
 * absent rather than a deployment which is broken. So the assertion is as
 * much about what does *not* happen — no throw at import time, nothing
 * loaded, no network — as about the boolean.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("aiSuggestionsConfigured", () => {
  it("is false when neither credential is set", () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", undefined);
    vi.stubEnv("VERCEL_OIDC_TOKEN", undefined);
    expect(aiSuggestionsConfigured()).toBe(false);
  });

  it("is false when a variable is present but empty", () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "");
    expect(aiSuggestionsConfigured()).toBe(false);
  });

  it("is true with an explicit gateway key", () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "set-for-this-test");
    vi.stubEnv("VERCEL_OIDC_TOKEN", undefined);
    expect(aiSuggestionsConfigured()).toBe(true);
  });

  /* The token a Vercel deployment is given, and what `vercel env pull` writes. */
  it("is true with only the deployment's OIDC token", () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", undefined);
    vi.stubEnv("VERCEL_OIDC_TOKEN", oidc(Date.now() + 3_600_000));
    expect(aiSuggestionsConfigured()).toBe(true);
  });

  /*
   * The case that was live rather than hypothetical. `vercel env pull` had
   * written a token two days earlier, the variable was still set, the button
   * was still rendered, and every press of it spent a round trip to reach
   * "the suggestion could not be made just now".
   */
  it("is false once the OIDC token has expired", () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", undefined);
    vi.stubEnv("VERCEL_OIDC_TOKEN", oidc(Date.now() - 1000));
    expect(aiSuggestionsConfigured()).toBe(false);
  });

  /* A token about to expire cannot outlive the request it would authorise. */
  it("is false for a token expiring within the minute", () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", undefined);
    vi.stubEnv("VERCEL_OIDC_TOKEN", oidc(Date.now() + 30_000));
    expect(aiSuggestionsConfigured()).toBe(false);
  });

  it("is false for a token it cannot read", () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", undefined);
    vi.stubEnv("VERCEL_OIDC_TOKEN", "not-a-jwt");
    expect(aiSuggestionsConfigured()).toBe(false);
  });

  /* An explicit key is not a JWT and is never asked to be one. */
  it("does not put an explicit key through the expiry check", () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "set-for-this-test");
    vi.stubEnv("VERCEL_OIDC_TOKEN", oidc(Date.now() - 1000));
    expect(aiSuggestionsConfigured()).toBe(true);
  });
});

/** A JWT with nothing in it but the one claim this module reads. */
function oidc(expiresAt: number): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(expiresAt / 1000) }),
  ).toString("base64url");
  return `header.${payload}.signature`;
}
