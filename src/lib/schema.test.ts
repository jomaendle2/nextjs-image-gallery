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

  /*
   * Two kinds of statement, idempotent for two different reasons. DDL is
   * guarded — `IF NOT EXISTS`, or a clause that is a no-op when already
   * applied. A backfill cannot be: it is safe to re-run because its
   * predicate stops matching once it has run.
   */
  const isBackfill = (statement: string): boolean =>
    statement.trimStart().toUpperCase().startsWith("UPDATE ");

  it("guards every schema statement so it can be re-run", () => {
    for (const statement of MIGRATIONS.filter((s) => !isBackfill(s))) {
      expect(statement).toMatch(/IF NOT EXISTS/);
    }
  });

  it("bounds every backfill with a predicate", () => {
    const backfills = MIGRATIONS.filter(isBackfill);
    expect(backfills.length).toBeGreaterThan(0);
    for (const statement of backfills) {
      /*
       * An unbounded `UPDATE ... SET` would rewrite every row on each deploy.
       * The predicate is also what makes a second run a no-op rather than a
       * repeat of the first.
       */
      expect(statement.toUpperCase()).toContain("WHERE");
    }
  });

  it("adds email to both auth tables and backfills it", () => {
    const statements = MIGRATIONS.join("\n");
    for (const table of ["login_tokens", "sessions"]) {
      expect(statements).toContain(
        `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS email TEXT;`,
      );
    }
    /*
     * The column has to arrive populated: sessions and tokens issued before
     * this migration are read through `email` afterwards, so an unbackfilled
     * row would sign its holder out mid-session.
     */
    expect(statements).toMatch(/UPDATE login_tokens .*SET email = c\.email/s);
    expect(statements).toMatch(/UPDATE sessions .*SET email = c\.email/s);
  });

  it("declares the auth tables before backfilling their new column", () => {
    const created = MIGRATIONS.findIndex((s) =>
      s.includes("CREATE TABLE IF NOT EXISTS sessions"),
    );
    const backfilled = MIGRATIONS.findIndex((s) =>
      s.includes("UPDATE sessions"),
    );
    expect(created).toBeLessThan(backfilled);
  });

  it("normalises exif written as the JSON value null", () => {
    /*
     * The bug this repairs: `JSON.stringify(null)::jsonb` stores a populated
     * cell containing null, so `WHERE exif IS NULL` matched no rows at all.
     */
    expect(MIGRATIONS).toContain(
      "UPDATE photos SET exif = NULL WHERE exif::text = 'null';",
    );
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
