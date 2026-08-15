"use client";

import { useCallback } from "react";
import { GlassButton } from "@/components/ui/glass-button";
import type { Contributor } from "@/lib/auth/types";
import { ActionError } from "./ActionError";
import { setRevoked } from "./actions";
import { useServerAction } from "./useServerAction";

export type ContributorRow = Contributor & {
  revoked_at: string | null;
  photo_count: number;
};

export function ContributorRowActions({ row }: { row: ContributorRow }) {
  const { pending, error, run } = useServerAction();
  const isRevoked = row.revoked_at !== null;

  const toggle = useCallback(() => {
    run(() => setRevoked(row.id, !isRevoked));
  }, [run, row.id, isRevoked]);

  // Revoking the owner would lock everyone out of this page.
  if (row.role === "owner") {
    return <span className="text-sm text-white/35">owner</span>;
  }

  return (
    <div>
      <GlassButton disabled={pending} onClick={toggle} size="sm">
        {isRevoked ? "Restore" : "Revoke"}
      </GlassButton>
      <ActionError message={error} />
    </div>
  );
}
