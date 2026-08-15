import Link from "next/link";
import { TOUCH_LINK } from "@/components/ui/field";
import { LEGAL_LINKS } from "@/lib/legal";

/**
 * The credit and the three legal notices, on every page that scrolls.
 *
 * The gallery itself deliberately has none of this. It is a fixed,
 * full-bleed viewer whose only chrome is one link to `/photographers`, and
 * hanging a legal footer under a photograph would undo the thing the whole
 * site is for. The German requirement is that a notice be reachable without
 * hunting — the settled reading is two clicks — and from any viewer that is
 * `photographers` and then this footer.
 *
 * Static, not fixed. The old footer was `fixed z-50`, so it floated over the
 * viewer and over these pages as they scrolled.
 */
export function SiteFooter({ className = "" }: { className?: string }) {
  return (
    <footer
      className={`flex flex-wrap items-center gap-x-5 gap-y-1 text-white/35 text-xs ${className}`}
    >
      <span>
        ©{" "}
        {/*
          The last control on the site under the touch floor: 58x14, at both
          widths. It is the only link here that sits inside a sentence rather
          than standing alone, so the exemption for prose does not cover it.
        */}
        <a
          className={`${TOUCH_LINK} transition-colors hover:text-white/70`}
          href="https://jomaendle.com"
          rel="noopener noreferrer"
          target="_blank"
        >
          Jo Mändle
        </a>
      </span>

      {LEGAL_LINKS.map(({ href, label }) => (
        <Link
          className={`${TOUCH_LINK} transition-colors hover:text-white/70`}
          href={href}
          key={href}
        >
          {label}
        </Link>
      ))}
    </footer>
  );
}
