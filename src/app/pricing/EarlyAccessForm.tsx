"use client";

import { useActionState, useId } from "react";
import { FIELD, LABEL, LABEL_HINT } from "@/components/ui/field";
import { GlassButton } from "@/components/ui/glass-button";
import { useFocusOnSuccess } from "@/hooks/useFocusOnSuccess";
import type { EarlyAccessTier } from "@/lib/waitlist/tiers";
import { type EarlyAccessState, requestEarlyAccess } from "./actions";

const INITIAL: EarlyAccessState = { tone: "idle", message: null };

/**
 * The form under a tier that does not exist, which is the only thing on
 * `/pricing` that produces a number.
 *
 * It asks for an address and, for Spaces, a screen count — and nothing else
 * that is required. Every extra required field on a form like this trades
 * responses for detail, and at this stage the count *is* the finding: ten
 * addresses are a signal to build and two are a signal to stop, and neither
 * conclusion changes if half of them left the note blank.
 *
 * The button is plain glass rather than primary, on both instances. Two
 * accent fills on one page is the state `design.test.ts` calls "neither is
 * primary" — and it would also be a lie about the page, which is not asking
 * the reader to do one thing. It is asking which of two things they want.
 */
export function EarlyAccessForm({
  tier,
  label,
}: {
  tier: EarlyAccessTier;
  /** What the submit says, so each form names the thing it is about. */
  label: string;
}) {
  const [state, formAction, pending] = useActionState(
    requestEarlyAccess,
    INITIAL,
  );
  const emailId = useId();
  const screensId = useId();
  const noteId = useId();
  const honeypotId = useId();

  /*
   * Same failure as the subscribe and apply forms: the confirmation replaces
   * the form, so the focused submit button is unmounted and focus falls to
   * `<body>`. See `useFocusOnSuccess`.
   */
  const sent = state.tone === "sent";
  const submitting = pending ? "Sending…" : label;
  const confirmation = useFocusOnSuccess<HTMLParagraphElement>(sent);

  if (sent) {
    return (
      <p
        className="glass-hairline rounded-2xl px-4 py-3 text-sm text-white/70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        ref={confirmation}
        tabIndex={-1}
      >
        Noted — thank you. You will hear from us once there is something real to
        show, and not before. Nothing else will be sent to that address.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input name="tier" type="hidden" value={tier} />

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

      {tier === "spaces" ? (
        <div className="space-y-1.5">
          <label className={LABEL} htmlFor={screensId}>
            How many screens <span className={LABEL_HINT}>(optional)</span>
          </label>
          {/*
            `inputMode="numeric"` rather than `type="number"`, which on a
            desktop browser adds spinners nobody wants on a one-off figure
            and on some Android keyboards offers a decimal point for a count
            of televisions. The validator refuses anything that is not a
            whole number either way; this is only about which keyboard opens.
          */}
          <input
            className={FIELD}
            id={screensId}
            inputMode="numeric"
            name="screens"
            placeholder="6"
          />
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label className={LABEL} htmlFor={noteId}>
          Anything we should know <span className={LABEL_HINT}>(optional)</span>
        </label>
        <textarea
          className={FIELD}
          id={noteId}
          name="note"
          placeholder={
            tier === "spaces"
              ? "Where the screens are, and what is on them now."
              : "Where you shoot, and what you plan around."
          }
          rows={2}
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

      {/*
        The label is computed above rather than ternaried inline, because a
        variable in the alternate branch of a JSX ternary is what
        `noLeakedRender` is looking for — it cannot tell a string from a
        value that would render as one.
      */}
      <GlassButton disabled={pending} fullWidth={true} size="sm" type="submit">
        {submitting}
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
