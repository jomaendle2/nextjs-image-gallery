"use client";

import { useCallback } from "react";
import { GlassButton } from "@/components/ui/glass-button";
import { ActionError } from "./ActionError";
import { decideApplication } from "./actions";
import { useServerAction } from "./useServerAction";

export function ApplicationRowActions({ id }: { id: string }) {
  const { pending, error, run } = useServerAction();

  const approve = useCallback(() => {
    run(() => decideApplication(id, "approved"));
  }, [run, id]);

  const decline = useCallback(() => {
    run(() => decideApplication(id, "declined"));
  }, [run, id]);

  return (
    <div>
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
      {/*
        This one matters most of the three: approving sends an email, and a
        failure here could mean the application was decided but the person
        never heard, or that nothing happened at all. Saying so beats a
        button that quietly returns to its resting state.
      */}
      <ActionError message={error} />
    </div>
  );
}
