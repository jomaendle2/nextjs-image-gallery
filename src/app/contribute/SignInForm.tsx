"use client";

import { useActionState, useId } from "react";
import { GlassButton } from "@/components/ui/glass-button";
import { requestSignIn, type SignInState } from "./actions";

const INITIAL: SignInState = { message: null };

export function SignInForm() {
  const [state, formAction, pending] = useActionState(requestSignIn, INITIAL);
  // A literal id would collide if this form were ever rendered twice.
  const emailId = useId();

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <div className="space-y-2">
        <label
          className="block font-medium text-sm text-white/70"
          htmlFor={emailId}
        >
          Email address
        </label>
        <input
          autoComplete="email"
          className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
          id={emailId}
          name="email"
          placeholder="you@example.com"
          required={true}
          type="email"
        />
      </div>

      <GlassButton disabled={pending} type="submit">
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
