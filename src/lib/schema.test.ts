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

  /*
   * `DROP NOT NULL` is the third kind: idempotent by nature rather than by
   * a guard clause, because dropping a constraint that is already absent is
   * a no-op in Postgres. It has no `IF NOT EXISTS` form to write, so the
   * rule recognises it rather than being relaxed — the point of this test is
   * that every statement is safe to re-run, not that every statement carries
   * a particular phrase.
   */
  const isConstraintDrop = (statement: string): boolean =>
    /ALTER COLUMN \w+ DROP NOT NULL/i.test(statement);

  it("guards every schema statement so it can be re-run", () => {
    const guarded = MIGRATIONS.filter(
      (s) => !(isBackfill(s) || isConstraintDrop(s)),
    );
    for (const statement of guarded) {
      expect(statement).toMatch(/IF NOT EXISTS/);
    }
  });

  it("only exempts constraint drops that really are constraint drops", () => {
    // The exemption is narrow on purpose: it must not become a hole through
    // which an unguarded `ALTER TABLE` of any other shape can pass.
    expect(
      isConstraintDrop("ALTER TABLE t ALTER COLUMN c DROP NOT NULL;"),
    ).toBe(true);
    expect(isConstraintDrop("ALTER TABLE t DROP COLUMN c;")).toBe(false);
    expect(isConstraintDrop("ALTER TABLE t ADD COLUMN c TEXT;")).toBe(false);
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

  /*
   * `NUMERIC` would typecheck and be wrong.
   *
   * The Neon HTTP driver returns numeric columns as *strings*, and these rows
   * are cast `as PhotoRow` with no runtime parsing — so a numeric column
   * would put `"47.3769"` behind a field declared `number`, pass `tsc`, and
   * project a dot at `NaN` on the globe with nothing anywhere reporting an
   * error. Double precision is returned as a number.
   *
   * Two sweeps rather than one, because one filter was doing two jobs badly.
   * It matched any statement *mentioning* a coordinate and then asserted that
   * statement declared a double-precision column — which held only for as
   * long as the only statements mentioning one were the four that declare it.
   * `has_member_details` reads `precise_lat` in a generated expression and was
   * counted as a fifth coordinate column.
   *
   * Narrowing the filter to declarations would have fixed the count and given
   * up the more valuable half: `ALTER COLUMN precise_lat TYPE NUMERIC` is not
   * a declaration, so a declaration-only filter sails straight past the exact
   * bug this test is named after, arriving by different syntax. So the broad
   * sweep keeps the `NUMERIC` ban, which is a rule about the whole file, and a
   * narrow one owns the count and the storage type, which are rules about the
   * four declarations.
   */
  it("keeps NUMERIC away from a coordinate, however it is spelled", () => {
    const mentions = MIGRATIONS.filter((statement) =>
      /(precise|coarse)_(lat|lng)/.test(statement),
    );
    // If this ever finds nothing, the detection has broken, not the code.
    expect(mentions.length).toBeGreaterThan(0);
    for (const statement of mentions) {
      expect(statement.toUpperCase()).not.toContain("NUMERIC");
    }
  });

  it("stores coordinates as double precision, never numeric", () => {
    const declared = MIGRATIONS.filter((statement) =>
      /ADD COLUMN IF NOT EXISTS (precise|coarse)_(lat|lng) /.test(statement),
    );
    expect(declared).toHaveLength(4);
    for (const statement of declared) {
      expect(statement).toContain("DOUBLE PRECISION");
    }
  });

  /*
   * Postgres has no `ADD CONSTRAINT IF NOT EXISTS`, so a range check here
   * would pass the first deploy and fail every one after it. Latitude and
   * longitude are validated in the server action instead, where being out of
   * range can become a sentence somebody reads.
   */
  it("adds no constraint that cannot be re-run", () => {
    for (const statement of MIGRATIONS) {
      expect(statement.toUpperCase()).not.toContain("ADD CONSTRAINT");
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
