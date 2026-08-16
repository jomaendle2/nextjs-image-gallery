"use client";

import { UserCheck, UserX } from "lucide-react";
import { useCallback } from "react";
import { ActionError } from "@/components/ui/ActionError";
import { GlassButton } from "@/components/ui/glass-button";
import { useServerAction } from "@/hooks/useServerAction";
import type { Contributor } from "@/lib/auth/types";
import { setRevoked } from "./actions";

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
    return <span className="text-sm text-white/55">owner</span>;
  }

  return (
    <div>
      {/*
        Revoking ends somebody's access, deletes their live sessions and
        pulls their photographs out of the gallery. It sat here in the same
        glass as every other control on the page, one of a column of
        identical buttons beside names — which is the arrangement most
        likely to produce a misclick and the one where a misclick costs
        most. Restoring is ordinary, so only the destructive direction is
        marked.
      */}
      <GlassButton
        className={
          isRevoked
            ? ""
            : "border-red-400/40 bg-red-500/15 text-red-100 hover:bg-red-500/25"
        }
        disabled={pending}
        onClick={toggle}
        size="sm"
      >
        {isRevoked ? (
          <UserCheck aria-hidden="true" className="mr-1.5" size={14} />
        ) : (
          <UserX aria-hidden="true" className="mr-1.5" size={14} />
        )}
        {isRevoked ? "Restore" : "Revoke"}
      </GlassButton>
      <ActionError message={error} />
    </div>
  );
}
