"use client";

import { useActionState, useId } from "react";
import { FIELD, LABEL } from "@/components/ui/field";
import { GlassButton } from "@/components/ui/glass-button";
import { type AdminFormState, invite } from "./actions";

const INITIAL: AdminFormState = { message: null };

export function InviteForm() {
  const [state, formAction, pending] = useActionState(invite, INITIAL);
  const emailId = useId();
  const nameId = useId();
  const siteId = useId();

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className={LABEL} htmlFor={nameId}>
            Display name
          </label>
          <input
            className={FIELD}
            id={nameId}
            name="display_name"
            placeholder="Anna Weber"
            required={true}
          />
        </div>

        <div className="space-y-1.5">
          <label className={LABEL} htmlFor={emailId}>
            Email address
          </label>
          <input
            className={FIELD}
            id={emailId}
            name="email"
            placeholder="anna@example.com"
            required={true}
            type="email"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={LABEL} htmlFor={siteId}>
          Their website <span className="text-white/35">(optional)</span>
        </label>
        <input
          className={FIELD}
          id={siteId}
          name="site_url"
          placeholder="https://annaweber.example"
          type="url"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <GlassButton disabled={pending} size="sm" type="submit">
          {pending ? "Inviting…" : "Invite"}
        </GlassButton>
        <p aria-live="polite" className="text-sm text-white/60">
          {state.message}
        </p>
      </div>
    </form>
  );
}
