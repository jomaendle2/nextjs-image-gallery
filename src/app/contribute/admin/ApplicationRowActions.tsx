"use client";

import { useCallback } from "react";
import { GlassButton } from "@/components/ui/glass-button";
import { decideApplication } from "./actions";
import { useServerAction } from "./useServerAction";

export function ApplicationRowActions({ id }: { id: string }) {
  const { pending, run } = useServerAction();

  const approve = useCallback(() => {
    run(() => decideApplication(id, "approved"));
  }, [run, id]);

  const decline = useCallback(() => {
    run(() => decideApplication(id, "declined"));
  }, [run, id]);

  return (
    <div className="flex flex-wrap gap-2">
      <GlassButton disabled={pending} onClick={approve} size="sm">
        {pending ? "Working…" : "Approve"}
      </GlassButton>
      <GlassButton
        className="text-white/60"
        disabled={pending}
        onClick={decline}
        size="sm"
      >
        Decline
      </GlassButton>
    </div>
  );
}
