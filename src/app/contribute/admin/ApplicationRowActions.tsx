"use client";

import { Check, X } from "lucide-react";
import { useCallback } from "react";
import { ActionError } from "@/components/ui/ActionError";
import { GlassButton } from "@/components/ui/glass-button";
import { useServerAction } from "@/hooks/useServerAction";
import { decideApplication } from "./actions";

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
        {/*
          Two buttons a thumb-width apart deciding whether somebody joins.
          Approving emails them and creates their account; declining closes
          the application and cannot be undone from this page. Both deserve
          to be told apart at a glance rather than read.
        */}
        <GlassButton disabled={pending} onClick={approve} size="sm">
          <Check aria-hidden="true" className="mr-1.5" size={14} />
          {pending ? "Working…" : "Approve"}
        </GlassButton>
        <GlassButton
          variant="arm"
          disabled={pending}
          onClick={decline}
          size="sm"
        >
          <X aria-hidden="true" className="mr-1.5" size={14} />
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
