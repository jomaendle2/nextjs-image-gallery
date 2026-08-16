/**
 * What an invite form gets back, whoever submitted it.
 *
 * Its own module rather than an export from `admin/actions.ts`, because the
 * form is now shared between the owner's page and a contributor's, and a
 * client component importing a type from an owner-only `"use server"` module
 * is a coupling that reads as permission to import a value from it later.
 *
 * `tone` exists because the previous form reported success and failure in
 * the same grey paragraph — "Invited anna@example.com" and "That address is
 * already invited" were visually identical, which leaves the reader to work
 * out whether anything happened.
 *
 * Deliberately no `remaining` count here: `useActionState` state is stale
 * until the next submit, and the number of invites somebody has left is
 * authoritative in the database. The page reads it and passes it as a prop,
 * and `revalidatePath` refreshes it after a successful claim.
 */
export interface InviteState {
  message: string | null;
  tone: "success" | "error";
}

export const NO_MESSAGE: InviteState = { message: null, tone: "error" };
