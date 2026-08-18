import process from "node:process";
import { describe, expect, it } from "vitest";

/**
 * The subscription lifecycle, against a real database.
 *
 * Every other test in this repo is pure, and this one deliberately is not:
 * the guarantees worth checking here — single-use tokens, "already confirmed
 * cannot be re-requested", "unsubscribe deletes" — live in SQL predicates
 * rather than in TypeScript, so a fake would only test the fake.
 *
 * Skipped when `DATABASE_URL` is absent, which is the ordinary `npm test`
 * case. Run it against a database with:
 *
 *   node --env-file=.env.local node_modules/.bin/vitest run subscribers
 *
 * The import is dynamic because `@/lib/database` throws at module load
 * without a connection string, which would fail the file before a `skipIf`
 * could take effect.
 */
const hasDatabase = Boolean(process.env["DATABASE_URL"]);

describe.skipIf(!hasDatabase)("subscription lifecycle", () => {
  const address = `vitest-${Date.now()}@example.test`;

  it("runs request → confirm → unsubscribe against real SQL", async () => {
    const repo = await import("./repository");
    const { sql } = await import("@/lib/database");

    try {
      // A request leaves an unconfirmed row and hands back a secret.
      const pending = await repo.requestSubscription(address);
      expect(pending).not.toBeNull();

      const rows = await sql`
        SELECT confirmed_at, confirm_token_hash FROM subscribers
        WHERE email = ${address};`;
      expect(rows.length).toBe(1);
      expect(rows[0]?.["confirmed_at"]).toBeNull();
      // The confirm secret goes in the URL; only its hash is kept.
      expect(rows[0]?.["confirm_token_hash"]).not.toBe(pending?.confirmSecret);

      // An unconfirmed address is never in a send.
      const beforeSend = await repo.listConfirmedSubscribers();
      expect(beforeSend.some((row) => row.email === address)).toBe(false);

      // A wrong token confirms nothing.
      expect(await repo.confirmSubscription("nonsense")).toBeNull();

      // The real one works exactly once.
      const confirmed = await repo.confirmSubscription(
        pending?.confirmSecret ?? "",
      );
      expect(confirmed?.email).toBe(address);
      expect(confirmed?.unsubscribeSecret).toBeTruthy();
      expect(
        await repo.confirmSubscription(pending?.confirmSecret ?? ""),
      ).toBeNull();

      const afterSend = await repo.listConfirmedSubscribers();
      const mine = afterSend.find((row) => row.email === address);
      expect(mine).toBeDefined();
      // The send has to be able to build an unsubscribe link from this, so
      // the token comes back usable rather than hashed.
      expect(mine?.unsubscribe_token).toBe(confirmed?.unsubscribeSecret);

      // A confirmed address cannot be re-requested, so nobody can be sent
      // "please confirm" for an address they already own.
      expect(await repo.requestSubscription(address)).toBeNull();

      // Unsubscribing deletes rather than flags.
      expect(await repo.unsubscribe("nonsense")).toBe(false);
      expect(await repo.unsubscribe(confirmed?.unsubscribeSecret ?? "")).toBe(
        true,
      );
      const gone = await sql`
        SELECT email FROM subscribers WHERE email = ${address};`;
      expect(gone.length).toBe(0);
    } finally {
      // Nothing of ours survives a failure partway through.
      await sql`DELETE FROM subscribers WHERE email = ${address};`;
    }
  });
});
