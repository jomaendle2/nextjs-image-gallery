"use client";

import { Send } from "lucide-react";
import { useCallback, useState } from "react";
import { ActionError } from "@/components/ui/ActionError";
import { GlassButton } from "@/components/ui/glass-button";
import { useServerAction } from "@/hooks/useServerAction";
import { announceNewWork } from "./actions";

/**
 * The one control that mails the subscriber list.
 *
 * Deliberately a button rather than anything automatic. The weekly cron
 * only tells the owner there is something waiting; a person still decides,
 * so a wrong title or an accidental publish cannot reach everybody before
 * anyone has looked at it.
 *
 * This component owns whether the whole section appears, rather than the
 * page deciding on `pending > 0`. That was the first shape and it had a
 * flaw worth remembering: sending drops the count to zero, the server
 * re-renders, the section unmounts — and the "sent to N" confirmation goes
 * with it, so the owner presses send and watches the panel vanish with no
 * word of what happened. Keeping the decision here lets the result outlive
 * the thing that produced it.
 */
export function AnnounceActions({
  pending,
  subscribers,
}: {
  pending: number;
  subscribers: number;
}) {
  const { pending: sending, error, run } = useServerAction();
  const [result, setResult] = useState<string | null>(null);

  const send = useCallback(() => {
    setResult(null);
    run(async () => {
      const outcome = await announceNewWork();
      const photographs =
        outcome.photographs === 1
          ? "1 photograph"
          : `${outcome.photographs} photographs`;
      const people =
        outcome.sent === 1 ? "1 subscriber" : `${outcome.sent} subscribers`;
      setResult(
        outcome.failed === 0
          ? `Sent ${photographs} to ${people}.`
          : `Sent ${photographs} to ${people}; ${outcome.failed} failed — see the server logs.`,
      );
    });
  }, [run]);

  // Nothing waiting and nothing to report: a permanent "0 waiting" panel is
  // noise on a page the owner opens to do something else.
  if (pending === 0 && result === null) {
    return null;
  }

  return (
    <section className="mb-8">
      <h2 className="mb-1 font-semibold text-lg tracking-[-0.03em]">
        {pending === 0 ? "Announced" : `Waiting to be announced (${pending})`}
      </h2>

      {pending === 0 ? null : (
        <p className="mb-4 text-sm text-white/55">
          Published since the last announcement.{" "}
          {subscribers === 1 ? "One person" : `${subscribers} people`} will
          receive it, each with their own unsubscribe link.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {pending === 0 ? null : (
          <GlassButton
            disabled={sending || subscribers === 0}
            onClick={send}
            size="sm"
          >
            <Send aria-hidden="true" className="mr-1.5" size={14} />
            {sending ? "Sending…" : `Announce ${pending}`}
          </GlassButton>
        )}
        {pending > 0 && subscribers === 0 ? (
          <span className="text-sm text-white/45">
            Nobody has confirmed a subscription yet.
          </span>
        ) : null}
        {result === null ? null : (
          <p aria-live="polite" className="text-sm text-white/70">
            {result}
          </p>
        )}
      </div>

      <ActionError message={error} />
    </section>
  );
}
