"use client";

import { useActionState, useId } from "react";
import { FIELD, LABEL, LABEL_HINT } from "@/components/ui/field";
import { GlassButton } from "@/components/ui/glass-button";
import { Notice } from "@/components/ui/Notice";
import { type InviteState, NO_MESSAGE } from "./invite-state";

/**
 * The three fields that bring a photographer into the gallery.
 *
 * One form for both doors. The owner's version and a contributor's ask for
 * exactly the same things and differ only in which action receives them and
 * whether there is a quota to show, so a second copy would have been two
 * places to fix a label. The action arrives as a prop — a reference, not a
 * bound call, which is what `noJsxPropsBind` forbids and what the actor
 * coming from the session makes unnecessary.
 *
 * `remaining` is a prop rather than part of the action's state, because
 * `useActionState` holds the previous result and the count is authoritative
 * in the database. The server page reads it; `revalidatePath` refreshes it
 * after a claim.
 */
export function InviteForm({
  action,
  remaining,
  submitLabel = "Invite",
}: {
  action: (state: InviteState, formData: FormData) => Promise<InviteState>;
  remaining?: number;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, NO_MESSAGE);
  const emailId = useId();
  const nameId = useId();
  const siteId = useId();

  const exhausted = remaining !== undefined && remaining <= 0;
  const label = pending ? "Inviting…" : submitLabel;

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className={LABEL} htmlFor={nameId}>
            Their name
          </label>
          <input
            className={FIELD}
            disabled={exhausted}
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
            disabled={exhausted}
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
          Their website <span className={LABEL_HINT}>(optional)</span>
        </label>
        <input
          className={FIELD}
          disabled={exhausted}
          id={siteId}
          name="site_url"
          placeholder="https://annaweber.example"
          type="url"
        />
      </div>

      <GlassButton
        disabled={pending || exhausted}
        size="sm"
        type="submit"
        variant="primary"
      >
        {label}
      </GlassButton>

      {/*
        Tone, rather than the grey paragraph this used to be — where
        "Invited anna@example.com" and "That address is already invited"
        looked identical and left the reader to work out whether anything
        had happened.
      */}
      {state.message ? (
        <Notice tone={state.tone}>{state.message}</Notice>
      ) : null}
    </form>
  );
}
