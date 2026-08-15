export type ContributorRole = "owner" | "contributor";

/** A signed-in person. Never constructed from client input. */
export interface Contributor {
  id: string;
  email: string;
  slug: string;
  display_name: string;
  site_url: string | null;
  role: ContributorRole;
}

export function isOwner(actor: Contributor): boolean {
  return actor.role === "owner";
}
