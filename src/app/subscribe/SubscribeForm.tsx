"use client";

import { useActionState, useId } from "react";
import { FIELD, LABEL } from "@/components/ui/field";
import { GlassButton } from "@/components/ui/glass-button";
import { useFocusOnSuccess } from "@/hooks/useFocusOnSuccess";
import { type SubscribeState, subscribe } from "./actions";

const INITIAL: SubscribeState = { tone: "idle", message: null };

export function SubscribeForm() {
  const [state, formAction, pending] = useActionState(subscribe, INITIAL);
  const emailId = useId();
  const honeypotId = useId();

  /*
   * Same failure as the apply form: the confirmation replaces the form, so
   * the focused submit button is unmounted and focus falls to `<body>`. See
   * `useFocusOnSuccess`.
   */
  const sent = state.tone === "sent";
  const confirmation = useFocusOnSuccess<HTMLParagraphElement>(sent);

  if (sent) {
    return (
      /*
       * The sentence itself is the focus target. There is no heading here and
       * inventing one to hold focus would add a rung to the type scale for an
       * accessibility mechanism, which is how scales grow.
       *
       * The `aria-live="polite"` it used to carry is gone rather than kept
       * alongside the focus move. It never did anything: the attribute
       * arrived in the same commit as the text it was meant to announce, and
       * a live region has to exist before content is put into it. An
       * attribute that looks like the fix is worse than no attribute, because
       * the next person reads it and stops looking.
       */
      <p
        className="glass-hairline rounded-2xl px-4 py-3 text-sm text-white/70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        ref={confirmation}
        tabIndex={-1}
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

      <GlassButton
        disabled={pending}
        fullWidth={true}
        size="sm"
        type="submit"
        variant="primary"
      >
        {pending ? "Sending…" : "Follow the gallery"}
      </GlassButton>

      {/*
        The error channel. Mounted from the first render and for as long as
        the form is, which is what makes it work — success does not come
        through here, it replaces the form and takes focus with it.
      */}
      <p aria-live="polite" className="min-h-5 text-sm text-white/55">
        {state.message}
      </p>
    </form>
  );
}
