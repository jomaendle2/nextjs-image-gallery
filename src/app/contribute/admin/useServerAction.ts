"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

/**
 * Runs a server action from an event handler and refreshes the server
 * components afterwards, so the row the button belongs to reflects the new
 * state without a full navigation.
 */
export function useServerAction(): {
  pending: boolean;
  run: (work: () => Promise<void>) => void;
} {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = useCallback(
    (work: () => Promise<void>) => {
      startTransition(async () => {
        await work();
        router.refresh();
      });
    },
    [router],
  );

  return { pending, run };
}
