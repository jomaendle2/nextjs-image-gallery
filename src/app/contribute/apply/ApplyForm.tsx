"use client";

import { useActionState, useId } from "react";
import { FIELD, LABEL, LABEL_HINT } from "@/components/ui/field";
import { GlassButton } from "@/components/ui/glass-button";
import { type ApplyState, apply } from "./actions";

const INITIAL: ApplyState = { status: "idle", message: null };

export function ApplyForm() {
  const [state, formAction, pending] = useActionState(apply, INITIAL);
  const nameId = useId();
  const emailId = useId();
  const siteId = useId();
  const noteId = useId();
  const trapId = useId();

  if (state.status === "sent") {
    return (
      <div className="glass-thin rounded-2xl p-6">
        <h2 className="font-semibold text-lg tracking-[-0.03em]">
          Application received
        </h2>
        <p className="mt-2 text-pretty text-sm text-white/60 leading-relaxed">
          Jo looks at every one personally, so a reply takes a few days rather
          than a few minutes. If it is a yes, you will get an email with a link
          to sign in and publish your first photograph.
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
        <GlassButton disabled={pending} type="submit" variant="primary">
          {pending ? "Sending…" : "Apply to contribute"}
        </GlassButton>
        <p aria-live="polite" className="text-sm text-white/60">
          {state.message}
        </p>
      </div>
    </form>
  );
}
