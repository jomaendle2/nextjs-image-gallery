"use client";

import { Send } from "lucide-react";
import { useCallback, useState } from "react";
import { ActionError } from "@/components/ui/ActionError";
import { GlassButton } from "@/components/ui/glass-button";
import { useServerAction } from "@/hooks/useServerAction";
import { describeAnnouncement } from "@/lib/announce-result";
import { count, counted } from "@/lib/plural";
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

/**
 * The armed state, as its own component.
 *
 * Two steps, matching the delete on a photograph — and this one has the
 * better claim to them. Deleting loses one photograph and the owner can ask
 * the photographer for it again. This puts a message in every subscriber's
 * inbox, and there is no version of the internet where that can be taken
 * back. It was a single click, next to a count, on a page opened to do
 * something else entirely.
 *
 * The question names both numbers, because "are you sure" asks something
 * nobody can answer; "16 photographs to 40 people" is the thing actually
 * being decided. Cancel takes focus, so the safe answer is the one a
 * keyboard reaches first.
 */
function ConfirmSend({
  pending,
  subscribers,
  sending,
  onCancel,
  onSend,
}: {
  pending: number;
  subscribers: number;
  sending: boolean;
  onCancel: () => void;
  onSend: () => void;
}) {
  return (
    <>
      <span className="text-sm text-white/80">
        Send {count(pending, "photograph")} to{" "}
        {counted(subscribers, "person", "people")}? This cannot be undone.
      </span>
      <GlassButton autoFocus={true} onClick={onCancel} size="sm">
        Not yet
      </GlassButton>
      <GlassButton
        className="border-amber-400/40 bg-amber-400/15 text-amber-100 hover:bg-amber-400/25"
        disabled={sending}
        onClick={onSend}
        size="sm"
      >
        <Send aria-hidden="true" className="mr-1.5" size={14} />
        {sending ? "Sending…" : "Send now"}
      </GlassButton>
    </>
  );
}

export function AnnounceActions({
  pending,
  subscribers,
}: {
  pending: number;
  subscribers: number;
}) {
  const { pending: sending, error, run } = useServerAction();
  const [result, setResult] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const arm = useCallback(() => setConfirming(true), []);
  const cancel = useCallback(() => setConfirming(false), []);

  const send = useCallback(() => {
    setResult(null);
    run(async () => {
      const outcome = await announceNewWork();
      setConfirming(false);
      setResult(describeAnnouncement(outcome));
    });
  }, [run]);

  // Nothing waiting and nothing to report: a permanent "0 waiting" panel is
  // noise on a page the owner opens to do something else.
  if (pending === 0 && result === null) {
    return null;
  }

  const armed = confirming && pending > 0;
  const noSubscribers = pending > 0 && subscribers === 0;

  return (
    <section className="mb-8">
      <h2 className="mb-1 font-semibold text-lg tracking-[-0.03em]">
        {pending === 0 ? "Announced" : `Waiting to be announced (${pending})`}
      </h2>

      {pending === 0 ? null : (
        <p className="mb-4 text-sm text-white/55">
          Published since the last announcement. It will go to{" "}
          {counted(subscribers, "person", "people")}, each with their own
          unsubscribe link.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {pending === 0 || armed ? null : (
          <GlassButton
            disabled={sending || subscribers === 0}
            onClick={arm}
            size="sm"
          >
            <Send aria-hidden="true" className="mr-1.5" size={14} />
            {`Announce ${pending}`}
          </GlassButton>
        )}

        {armed ? (
          <ConfirmSend
            onCancel={cancel}
            onSend={send}
            pending={pending}
            sending={sending}
            subscribers={subscribers}
          />
        ) : null}

        {noSubscribers ? (
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
