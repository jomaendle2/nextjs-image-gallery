import { describe, expect, it } from "vitest";
import { MIGRATIONS } from "./schema";

describe("MIGRATIONS", () => {
  it("creates every table the feature needs", () => {
    const statements = MIGRATIONS.join("\n");
    for (const table of [
      "contributors",
      "photos",
      "login_tokens",
      "sessions",
    ]) {
      expect(statements).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it("never mutates the pre-existing image_views table", () => {
    const statements = MIGRATIONS.join("\n").toUpperCase();
    expect(statements).not.toContain("DROP TABLE");
    expect(statements).not.toContain("ALTER TABLE IMAGE_VIEWS");
  });

  it("is idempotent by construction", () => {
    for (const statement of MIGRATIONS) {
      expect(statement).toMatch(/IF NOT EXISTS/);
    }
  });

  it("declares contributors before photos, which references it", () => {
    const contributors = MIGRATIONS.findIndex((s) =>
      s.includes("CREATE TABLE IF NOT EXISTS contributors"),
    );
    const photos = MIGRATIONS.findIndex((s) =>
      s.includes("CREATE TABLE IF NOT EXISTS photos"),
    );
    expect(contributors).toBeLessThan(photos);
  });
});
