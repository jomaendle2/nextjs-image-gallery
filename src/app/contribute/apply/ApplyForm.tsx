"use client";

import { useActionState, useId } from "react";
import {
  FIELD,
  LABEL,
  LABEL_HINT,
  SECTION_HEADING,
} from "@/components/ui/field";
import { GlassButton } from "@/components/ui/glass-button";
import { useFocusOnSuccess } from "@/hooks/useFocusOnSuccess";
import { OPERATOR } from "@/lib/legal";
import { type ApplyState, apply } from "./actions";

const INITIAL: ApplyState = { tone: "idle", message: null };

export function ApplyForm() {
  const [state, formAction, pending] = useActionState(apply, INITIAL);
  const nameId = useId();
  const emailId = useId();
  const siteId = useId();
  const noteId = useId();
  const trapId = useId();

  /*
   * The submit button this form was focused on is about to stop existing.
   * See `useFocusOnSuccess` — the hook is where the reasoning lives, and it
   * is shared with the subscribe form, which fails in the same way.
   */
  const sent = state.tone === "sent";
  const heading = useFocusOnSuccess<HTMLHeadingElement>(sent);

  if (sent) {
    return (
      <div className="glass-thin rounded-2xl p-6">
        {/*
          `tabIndex={-1}` so the hook above can put the reader here. It is
          the first thing in the panel and it says what happened, which is
          the whole reason to move somebody rather than leave them at the top
          of the document wondering whether the button worked.
        */}
        <h2
          className={`${SECTION_HEADING} rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent`}
          ref={heading}
          tabIndex={-1}
        >
          Application received
        </h2>
        <p className="mt-2 text-pretty text-sm text-white/60 leading-relaxed">
          {OPERATOR.name} looks at every one personally, so a reply takes a few
          days rather than a few minutes. If it is a yes, you will get an email
          with a link to sign in and publish your first photograph.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className={LABEL} htmlFor={nameId}>
            Your name
          </label>
          <input
            autoComplete="name"
            className={FIELD}
            id={nameId}
            name="display_name"
            placeholder="Anna Weber"
            required={true}
          />
        </div>

        <div className="space-y-1.5">
          <label className={LABEL} htmlFor={emailId}>
            Email
          </label>
          <input
            autoComplete="email"
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
          Where can we see your work?
        </label>
        <input
          className={FIELD}
          id={siteId}
          name="site_url"
          placeholder="annaweber.com — or your Instagram"
          required={true}
        />
        <p className="text-white/55 text-xs">
          A portfolio, an Instagram, anything with photographs on it.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className={LABEL} htmlFor={noteId}>
          What do you photograph? <span className={LABEL_HINT}>(optional)</span>
        </label>
        <input
          className={FIELD}
          id={noteId}
          maxLength={200}
          name="note"
          placeholder="Coastlines, mostly at dawn."
        />
      </div>

      {/*
        Honeypot. Hidden from people and from screen readers, irresistible to
        naive bots. `tabIndex={-1}` keeps it out of the keyboard path too.
      */}
      <div aria-hidden="true" className="absolute left-[-9999px]">
        <label htmlFor={trapId}>Website</label>
        <input
          autoComplete="off"
          id={trapId}
          name="website"
          tabIndex={-1}
          type="text"
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <GlassButton
          disabled={pending}
          fullWidth={true}
          type="submit"
          variant="primary"
        >
          {pending ? "Sending…" : "Apply to contribute"}
        </GlassButton>
        {/*
          The error channel, and only that. It is mounted from the first
          render and stays mounted for as long as the form does, which is the
          condition a live region has to meet — one inserted alongside its own
          text announces nothing. Success is not routed through here: it
          unmounts this form, and the reader is moved to the confirmation
          instead.
        */}
        <p aria-live="polite" className="text-sm text-white/60">
          {state.message}
        </p>
      </div>
    </form>
  );
}
