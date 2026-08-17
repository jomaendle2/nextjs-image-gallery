"use client";

import { useActionState, useId } from "react";
import { IDLE } from "@/app/form-state";
import { FIELD, LABEL } from "@/components/ui/field";
import { GlassButton } from "@/components/ui/glass-button";
import { requestSignIn, type SignInState } from "./actions";

const INITIAL: SignInState = IDLE;

export function SignInForm() {
  const [state, formAction, pending] = useActionState(requestSignIn, INITIAL);
  // A literal id would collide if this form were ever rendered twice.
  const emailId = useId();

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <div className="space-y-2">
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

      <GlassButton
        disabled={pending}
        fullWidth={true}
        type="submit"
        variant="primary"
      >
        {pending ? "Sending…" : "Email me a link"}
      </GlassButton>

      {/*
        Announced politely so the confirmation reaches screen-reader users;
        the message is identical whether or not the address was invited.
      */}
      <p aria-live="polite" className="min-h-6 text-sm text-white/60">
        {state.message}
      </p>
    </form>
  );
}
