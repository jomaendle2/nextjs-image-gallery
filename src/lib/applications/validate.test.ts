import { describe, expect, it } from "vitest";
import { validateApplication } from "./validate";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

const valid = {
  display_name: "Anna Weber",
  email: "Anna@Example.com ",
  site_url: "annaweber.example/work",
  note: "Coastlines, mostly at dawn.",
};

describe("validateApplication", () => {
  it("accepts a complete application", () => {
    const result = validateApplication(form(valid));
    expect(result.ok).toBe(true);
  });

  it("normalises the email so it matches a later sign-in", () => {
    const result = validateApplication(form(valid));
    expect(result.ok && result.value.email).toBe("anna@example.com");
  });

  it("upgrades a bare host rather than rejecting it", () => {
    // Photographers write "instagram.com/name" far more often than a scheme.
    const result = validateApplication(form(valid));
    expect(result.ok && result.value.site_url).toBe(
      "https://annaweber.example/work",
    );
  });

  it("keeps an explicit scheme as given", () => {
    const result = validateApplication(
      form({ ...valid, site_url: "http://anna.example/" }),
    );
    expect(result.ok && result.value.site_url).toBe("http://anna.example/");
  });

  it("rejects a link with no dot in the host", () => {
    const result = validateApplication(
      form({ ...valid, site_url: "portfolio" }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a non-http scheme", () => {
    const result = validateApplication(
      form({ ...valid, site_url: "javascript:alert(1)" }),
    );
    expect(result.ok).toBe(false);
  });

  it("requires a name", () => {
    const result = validateApplication(form({ ...valid, display_name: "  " }));
    expect(result.ok).toBe(false);
  });

  it("requires something that looks like an email", () => {
    for (const email of ["anna", "@example.com", "anna@"]) {
      expect(validateApplication(form({ ...valid, email })).ok).toBe(false);
    }
  });

  it("treats a missing note as absent rather than empty", () => {
    const result = validateApplication(form({ ...valid, note: "   " }));
    expect(result.ok && result.value.note).toBeNull();
  });

  it("truncates an overlong note instead of rejecting the application", () => {
    const result = validateApplication(
      form({ ...valid, note: "x".repeat(500) }),
    );
    expect(result.ok ? result.value.note : "").toHaveLength(200);
  });

  it("silently drops a submission that fills the honeypot", () => {
    const result = validateApplication(form({ ...valid, website: "spam" }));
    expect(result).toEqual({ ok: false, error: "SILENT_DROP" });
  });
});
