import { describe, expect, it } from "vitest";
import { generateSecret, hashSecret } from "./secrets";

describe("generateSecret", () => {
  it("is 256 bits of url-safe randomness", () => {
    expect(generateSecret()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("never repeats", () => {
    const secrets = new Set(Array.from({ length: 1000 }, generateSecret));
    expect(secrets.size).toBe(1000);
  });

  it("survives a round trip through a URL unchanged", () => {
    const secret = generateSecret();
    const url = new URL(`https://example.test/verify?token=${secret}`);
    expect(url.searchParams.get("token")).toBe(secret);
  });
});

describe("hashSecret", () => {
  it("is deterministic", () => {
    const secret = generateSecret();
    expect(hashSecret(secret)).toBe(hashSecret(secret));
  });

  it("produces a sha256 hex digest", () => {
    expect(hashSecret("hello")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("does not contain the secret it hashed", () => {
    // What is stored must not be replayable as a login link.
    const secret = generateSecret();
    expect(hashSecret(secret)).not.toContain(secret);
  });

  it("separates two secrets that differ by one character", () => {
    expect(hashSecret("token-a")).not.toBe(hashSecret("token-b"));
  });
});
