"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

/**
 * The browser says "Failed to fetch" when a request never arrives, which is
 * true and tells an operator nothing about what to do. Everything else is
 * passed through: the messages we raise ourselves ("Not allowed.") are worth
 * reading, and in production Next replaces an uncaught server error's message
 * with a digest, which is the point of the digest.
 */
function readableError(cause: unknown): string {
  if (!(cause instanceof Error) || cause.message === "") {
    return "That did not work.";
  }
  if (cause.name === "TypeError" || cause.message === "Failed to fetch") {
    return "Could not reach the server. Nothing was changed.";
  }
  return cause.message;
}

interface ServerAction {
  pending: boolean;
  /** Set when the last run failed. Cleared when another is started. */
  error: string | null;
  run: (work: () => Promise<void>) => void;
}

/**
 * Runs a server action from an event handler and refreshes the server
 * components afterwards, so the row the button belongs to reflects the new
 * state without a full navigation.
 *
 * Failure is caught here rather than left to propagate. An action that
 * throws inside a transition reaches the nearest error boundary, which means
 * one failed "Revoke" replaced the entire admin page with "That didn't
 * load" — the operator lost their place in a list of contributors and was
 * told nothing about which action had failed, or that anything specific
 * had. A row that reports its own failure and leaves the page alone is the
 * right size of consequence.
 *
 * `router.refresh()` deliberately does not run on failure: nothing changed
 * on the server, and refreshing would only redraw the same rows while
 * discarding the message explaining why.
 */
export function useServerAction(): ServerAction {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const run = useCallback(
    (work: () => Promise<void>) => {
      setError(null);
      startTransition(async () => {
        try {
          await work();
        } catch (cause) {
          setError(readableError(cause));
          return;
        }
        router.refresh();
      });
    },
    [router],
  );

  return { pending, error, run };
}
