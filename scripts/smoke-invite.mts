/**
 * The invite quota, against a real database.
 *
 * These rules are stateful and concurrent, which is exactly what a unit test
 * cannot reach and what source-text invariants can only approximate. The
 * assertion this file exists for is the last one: two claims fired at once
 * from a contributor with one invite left must produce one contributor and
 * one decrement. That is the property the single-statement design buys, and
 * the one that breaks the moment somebody "simplifies" it into a read
 * followed by a write.
 *
 * Everything is created under a per-process tag and deleted in a `finally`,
 * so a failure halfway leaves nothing behind.
 *
 *   npm run smoke:invite
 */
import process from "node:process";
import {
  claimInvite,
  invitesRemaining,
  listInvitees,
} from "../src/lib/auth/contributors.ts";
import { sql } from "../src/lib/database.ts";
import { confirmDestructive } from "./guard.mts";
import { check, finish } from "./harness.mts";

confirmDestructive("create and delete contributors in this database");

const tag = `smoke-invite-${process.pid}`;
const inviterId = `${tag}-inviter`;
const inviterEmail = `${tag}@example.invalid`;

async function seedInviter(
  id: string,
  email: string,
  invites: number,
  revoked = false,
) {
  await sql`
    INSERT INTO contributors
      (id, email, slug, display_name, role, invites_remaining, revoked_at)
    VALUES (${id}, ${email}, ${id}, 'Smoke Inviter', 'contributor',
            ${invites}, ${revoked ? new Date().toISOString() : null});`;
}

function invite(id: string, suffix: string, name: string) {
  return claimInvite({
    inviterId: id,
    email: `${tag}-${suffix}@example.invalid`,
    display_name: name,
    site_url: null,
  });
}

await seedInviter(inviterId, inviterEmail, 2);

try {
  console.log("Spending an invite");
  const first = await invite(inviterId, "a", "Smoke One");
  check(
    "an invite creates a contributor",
    first.status === "invited",
    first.status,
  );
  check(
    "and reports what is left",
    first.status === "invited" && first.remaining === 1,
  );
  check(
    "the counter really dropped",
    (await invitesRemaining(inviterId)) === 1,
  );
  check(
    "the invitee is attributed to the inviter",
    (await listInvitees(inviterId)).length === 1,
  );
  check(
    "and starts with three of their own",
    first.status === "invited" &&
      (await invitesRemaining(first.contributor.id)) === 3,
  );

  console.log("Refusals must not cost anything");
  const duplicate = await invite(inviterId, "a", "Smoke One Again");
  check(
    "an address that already exists is refused",
    duplicate.status === "already-a-contributor",
    duplicate.status,
  );
  check(
    "and does not spend an invite",
    (await invitesRemaining(inviterId)) === 1,
  );

  const self = await claimInvite({
    inviterId,
    email: inviterEmail,
    display_name: "Myself",
    site_url: null,
  });
  check(
    "inviting yourself is refused",
    self.status === "already-a-contributor",
    self.status,
  );
  check("and costs nothing", (await invitesRemaining(inviterId)) === 1);

  console.log("Running out");
  const second = await invite(inviterId, "b", "Smoke Two");
  check("the last invite works", second.status === "invited", second.status);
  const third = await invite(inviterId, "c", "Smoke Three");
  check(
    "the next one is refused for the right reason",
    third.status === "no-invites-left",
    third.status,
  );
  check(
    "the counter never goes negative",
    (await invitesRemaining(inviterId)) === 0,
  );

  console.log("Two at once, with one left");
  await sql`UPDATE contributors SET invites_remaining = 1 WHERE id = ${inviterId};`;
  const raced = await Promise.all([
    invite(inviterId, "d", "Race D"),
    invite(inviterId, "e", "Race E"),
  ]);
  const won = raced.filter((r) => r.status === "invited").length;
  check("exactly one claim wins", won === 1, `${won} won`);
  check(
    "exactly one invite was spent",
    (await invitesRemaining(inviterId)) === 0,
  );

  console.log("Eligibility");
  const revokedId = `${tag}-revoked`;
  await seedInviter(revokedId, `${tag}-rev@example.invalid`, 3, true);
  const byRevoked = await invite(revokedId, "f", "From Revoked");
  check(
    "a revoked contributor cannot invite",
    byRevoked.status === "inviter-not-eligible",
    byRevoked.status,
  );
  check(
    "and their quota is untouched",
    (await invitesRemaining(revokedId)) === 3,
  );
} finally {
  await sql`DELETE FROM contributors WHERE email LIKE ${`${tag}%`};`;
  const left = await sql`
    SELECT count(*)::int AS n FROM contributors WHERE email LIKE ${`${tag}%`};`;
  console.log(`\ncleaned up, ${(left[0] as { n: number }).n} rows left`);
}

finish();
