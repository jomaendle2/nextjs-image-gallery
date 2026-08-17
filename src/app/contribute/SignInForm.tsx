"use client";

import { useActionState, useId, useState } from "react";
import { IDLE } from "@/app/form-state";
import { FIELD, LABEL } from "@/components/ui/field";
import { GlassButton } from "@/components/ui/glass-button";
import { Notice } from "@/components/ui/Notice";
import { useFocusOnSuccess } from "@/hooks/useFocusOnSuccess";
import { requestSignIn, type SignInState } from "./actions";

const INITIAL: SignInState = IDLE;

/**
 * Asking for a link, and being told it went.
 *
 * **This form used to have no terminal state at all.** It printed one grey
 * sentence into a `min-h-6 text-white/60` paragraph below the button and left
 * the field exactly as it was, so the strongest signal that anything had
 * happened was a line of text in the same colour as the placeholder. It also
 * threw away `state.tone`, which meant *"That does not look like an email
 * address"* and *"a link is on its way"* were typographically identical — the
 * only way to tell a refusal from a success was to read it.
 *
 * Now the answer replaces the question, because there is nothing left to fill
 * in: the panel names the address, says how long the link lasts, says what to
 * do if it does not arrive, and can send another without anybody retyping
 * anything. Errors keep the form, because there is something to correct.
 */
export function SignInForm() {
  const [state, formAction, pending] = useActionState(requestSignIn, INITIAL);
  // A literal id would collide if this form were ever rendered twice.
  const emailId = useId();

  /*
   * Held here as well as posted, so the confirmation can name the address and
   * "send another" can resubmit it. `useActionState` hands back the action's
   * return value, not the form's fields, and asking somebody to retype an
   * address they have already typed in order to be told again that a link is
   * coming is the sort of small insult that makes a site feel unfinished.
   */
  const [email, setEmail] = useState("");

  const done = state.tone === "sent";
  const confirmation = useFocusOnSuccess<HTMLParagraphElement>(done);

  if (done) {
    return (
      <div className="max-w-md space-y-4">
        {/*
          The sentence is the focus target, following `SubscribeForm`: no
          heading here, because inventing one to hold focus would add a rung to
          the type scale for an accessibility mechanism.

          The hedge — "if that address is on the list" — is deliberate and is
          the same neutrality the action has always had. An unknown address, a
          revoked contributor and a mail outage all land here, because a form
          that distinguished them would answer the question "who has been
          invited?".
        */}
        <p
          className="glass-hairline rounded-2xl px-4 py-3 text-sm text-white/70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          ref={confirmation}
          tabIndex={-1}
        >
          Check your inbox. If <span className="text-white">{email}</span> is on
          the list, a sign-in link is on its way — it works once and lasts an
          hour.
        </p>

        <form action={formAction} className="space-y-2">
          {/*
            The same address, carried rather than retyped. It is posted as a
            hidden field so this is one ordinary form submission through the
            same action and the same rate limiter, rather than a second path
            that would need its own.
          */}
          <input name="email" type="hidden" value={email} />
          <p className="text-[0.8125rem] text-white/55 leading-relaxed">
            Nothing after a minute or two? Look in spam — then send another.
          </p>
          <GlassButton disabled={pending} type="submit">
            {pending ? "Sending…" : "Send another link"}
          </GlassButton>
        </form>
      </div>
    );
  }

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
          onChange={(event) => {
            setEmail(event.target.value);
          }}
          placeholder="you@example.com"
          required={true}
          type="email"
          value={email}
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
        A refusal looks like a refusal now. `Notice` carries the tone the
        action has always returned and this form has always discarded — and it
        is `role="alert"` for errors, so it reaches a screen reader without a
        live region of our own.
      */}
      {state.tone === "error" && state.message !== null ? (
        <Notice tone="error">{state.message}</Notice>
      ) : null}
    </form>
  );
}
