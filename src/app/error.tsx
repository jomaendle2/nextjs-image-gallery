"use client";

import { useEffect } from "react";
import { StatusPage } from "@/components/StatusPage";
import { GlassButton } from "@/components/ui/glass-button";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * The boundary for anything that throws while rendering a route.
 *
 * `reset()` re-renders the segment rather than reloading the document, so a
 * transient failure — a database wobble on a page that fetches photographs —
 * costs the reader one tap and none of the page they already have.
 *
 * The message stays vague on purpose. `error.message` is the server's words,
 * not the reader's, and in production Next replaces it with a digest anyway;
 * printing either just moves the confusion onto the screen.
 */
export default function RouteError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Reaches the platform's runtime logs, where the digest ties this back to
    // the server-side stack that Next redacted from the client.
    console.error("Route error", error.digest ?? "", error);
  }, [error]);

  return (
    <StatusPage
      action={
        <GlassButton onClick={reset} size="sm">
          Try again
        </GlassButton>
      }
      detail="Something went wrong loading this page. It is usually worth trying once more."
      title="That didn't load"
    />
  );
}
