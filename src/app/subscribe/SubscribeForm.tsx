"use client";

import { useActionState, useId } from "react";
import { FIELD, LABEL } from "@/components/ui/field";
import { GlassButton } from "@/components/ui/glass-button";
import { type SubscribeState, subscribe } from "./actions";

const INITIAL: SubscribeState = { status: "idle", message: null };

export function SubscribeForm() {
  const [state, formAction, pending] = useActionState(subscribe, INITIAL);
  const emailId = useId();
  const honeypotId = useId();

  if (state.status === "sent") {
    return (
      <p
        aria-live="polite"
        className="glass-hairline rounded-2xl px-4 py-3 text-sm text-white/70"
      >
        Check your inbox — there is a link to confirm. Nothing will be sent to
        that address until you do.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1.5">
        <label className={LABEL} htmlFor={emailId}>
          Email address
        </label>
        <input
          autoComplete="email"
          className={FIELD}
          id={emailId}
          name="email"
          placeholder="you@example.com"
          required={true}
          type="email"
        />
      </div>

      {/*
        The honeypot, positioned off-screen rather than hidden with
        `display:none` — some bots skip anything a browser would not paint.
        `aria-hidden` and `tabIndex={-1}` keep it away from anyone real.
      */}
      <div aria-hidden="true" className="absolute left-[-9999px]">
        <label htmlFor={honeypotId}>Website</label>
        <input
          autoComplete="off"
          id={honeypotId}
          name="website"
          tabIndex={-1}
          type="text"
        />
      </div>

      <GlassButton disabled={pending} size="sm" type="submit" variant="primary">
        {pending ? "Sending…" : "Email me new work"}
      </GlassButton>

      <p aria-live="polite" className="min-h-5 text-sm text-white/55">
        {state.message}
      </p>
    </form>
  );
}
