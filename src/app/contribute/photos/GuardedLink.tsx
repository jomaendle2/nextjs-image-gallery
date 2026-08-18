"use client";

import Link from "next/link";
import { type ComponentProps, useCallback } from "react";
import { askBeforeLeaving, hasUnsaved } from "./unsaved";

/**
 * A link that asks first, when leaving would throw away a typed caption.
 *
 * `UnsavedGuard`'s `beforeunload` covers a reload, a closed tab and a typed
 * URL. It cannot cover this one: a Next `<Link>` never unloads the document,
 * so the workspace nav sitting directly above the form was the easiest way in
 * the whole page to lose ten minutes of captioning — one click, no warning,
 * and the text is gone with no way back to it.
 *
 * `onNavigate` rather than `onClick`, and that choice is the whole component.
 * It is called only for a real client-side navigation, so every case that
 * must *not* be blocked is already excluded by the framework: Cmd-click and
 * Ctrl-click open a new tab and never reach it, external URLs never reach it,
 * and a `download` link never reaches it. A hand-rolled click interceptor has
 * to get all three right, and a missed one silently swallows somebody's
 * middle-click.
 *
 * What it does *not* do is decide anything. It cancels the navigation and
 * records where the click was headed; the question, and the two answers, are
 * `UnsavedGuard`'s — which is what keeps this usable from any link without
 * every link growing a dialog of its own.
 */
export function GuardedLink({
  href,
  children,
  ...rest
}: Omit<ComponentProps<typeof Link>, "href" | "onNavigate"> & {
  href: string;
}) {
  const ask = useCallback(
    (event: { preventDefault: () => void }) => {
      if (!hasUnsaved()) {
        return;
      }
      event.preventDefault();
      askBeforeLeaving(href);
    },
    [href],
  );

  return (
    <Link href={href} onNavigate={ask} {...rest}>
      {children}
    </Link>
  );
}
