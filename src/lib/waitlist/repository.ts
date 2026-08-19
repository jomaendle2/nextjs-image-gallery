import { nanoid } from "nanoid";
import { sql } from "@/lib/database";
import type { EarlyAccessTier } from "./tiers";
import type { EarlyAccessInput } from "./validate";

/** Matching the photo ids: short in a URL, collisions negligible. */
const ID_LENGTH = 12;

export interface EarlyAccessRequest {
  id: string;
  email: string;
  tier: EarlyAccessTier;
  note: string;
  screens: number | null;
  created_at: string;
}

/**
 * Records somebody's interest in a tier that does not exist yet.
 *
 * Upserts on `(email, tier)`, so asking twice replaces the answer rather than
 * adding a row. That is the difference between a register of people and a
 * register of clicks, and only one of the two is worth deciding a quarter's
 * work from — somebody who submits, remembers the number of screens and
 * submits again should count once, with the second answer.
 *
 * `note` and `screens` are overwritten on conflict rather than coalesced. A
 * second submission is a correction, and the commonest correction is
 * emptying a field that was filled in wrongly the first time.
 */
export async function recordEarlyAccess(
  input: EarlyAccessInput,
): Promise<void> {
  await sql`
    INSERT INTO waitlist (id, email, tier, note, screens)
    VALUES (${nanoid(ID_LENGTH)}, ${input.email}, ${input.tier},
            ${input.note}, ${input.screens})
    ON CONFLICT (email, tier) DO UPDATE
      SET note = EXCLUDED.note,
          screens = EXCLUDED.screens;
  `;
}

/**
 * Every request, newest first, for the one page that reads them.
 *
 * Unpaginated on purpose. This is the owner's admin table and the whole
 * exercise is over once the number is either convincing or not — a register
 * that needs paging is a register that has already answered its question.
 */
export async function listEarlyAccess(): Promise<EarlyAccessRequest[]> {
  const rows = await sql`
    SELECT id, email, tier, note, screens, created_at
      FROM waitlist
     ORDER BY created_at DESC;
  `;
  return rows as EarlyAccessRequest[];
}
