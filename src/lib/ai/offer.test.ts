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
    vi.stubEnv("VERCEL_OIDC_TOKEN", "set-for-this-test");
    expect(aiSuggestionsConfigured()).toBe(true);
  });
});
