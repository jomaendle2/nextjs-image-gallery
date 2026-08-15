import { nanoid } from "nanoid";
import { sql } from "@/lib/database";
import type { ApplicationInput } from "./validate";

const ID_LENGTH = 12;

export interface ApplicationRow {
  id: string;
  email: string;
  display_name: string;
  site_url: string;
  note: string | null;
  status: "pending" | "approved" | "declined";
  created_at: string;
}

/**
 * Records an application, or quietly does nothing if that address already has
 * one open — enforced by the partial unique index rather than a read first,
 * so two simultaneous submissions cannot both land.
 */
export async function submitApplication(
  input: ApplicationInput,
): Promise<void> {
  await sql`
    INSERT INTO applications (id, email, display_name, site_url, note)
    VALUES (${nanoid(ID_LENGTH)}, ${input.email}, ${input.display_name},
            ${input.site_url}, ${input.note})
    ON CONFLICT DO NOTHING;
  `;
}

export async function listPendingApplications(): Promise<ApplicationRow[]> {
  const rows = await sql`
    SELECT id, email, display_name, site_url, note, status, created_at
    FROM applications
    WHERE status = 'pending'
    ORDER BY created_at ASC;
  `;
  return rows as ApplicationRow[];
}

/** Returns the application so the caller can invite or notify from it. */
export async function reviewApplication(
  id: string,
  status: "approved" | "declined",
): Promise<ApplicationRow | undefined> {
  const rows = await sql`
    UPDATE applications
    SET status = ${status}, reviewed_at = now()
    WHERE id = ${id} AND status = 'pending'
    RETURNING id, email, display_name, site_url, note, status, created_at;
  `;
  return rows[0] as ApplicationRow | undefined;
}
