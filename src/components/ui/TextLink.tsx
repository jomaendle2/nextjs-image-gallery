import Link from "next/link";
import type { ReactNode } from "react";
import { LINK, TOUCH_LINK } from "./field";

/**
 * A link on a page that is read rather than looked through.
 *
 * There were four spellings of this before it existed — two underline
 * offsets, two focus rings, `transition-colors` on three of them — plus a
 * separate decision each time about whether the 44px touch floor applied.
 * That is a lot of independent choices for "a link", and independent choices
 * are what a design system is for removing.
 *
 * `standalone` is the one real distinction, and it is a rule rather than a
 * taste: a link sitting on its own line needs a finger-sized target, while a
 * link inside a sentence is exempt because the sentence around it cannot be
 * grown to 44px without wrecking the line height. The padding is pulled
 * straight back out by a negative margin, so the target grows without moving
 * anything.
 *
 * External links get `rel="noopener noreferrer"` here rather than at each
 * call site, because that is exactly the sort of thing one call site forgets.
 */
export function TextLink({
  href,
  children,
  standalone = false,
  external = false,
  className = "",
}: {
  href: string;
  children: ReactNode;
  standalone?: boolean;
  external?: boolean;
  className?: string;
}) {
  const classes = [LINK, standalone ? TOUCH_LINK : "", className]
    .filter(Boolean)
    .join(" ");

  if (external) {
    return (
      <a
        className={classes}
        href={href}
        rel="noopener noreferrer"
        target="_blank"
      >
        {children}
      </a>
    );
  }

  return (
    <Link className={classes} href={href}>
      {children}
    </Link>
  );
}
