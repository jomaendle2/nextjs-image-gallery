import Link from "next/link";
import type { ReactNode } from "react";
import { TOUCH_LINK } from "@/components/ui/field";

/**
 * The frame every /contribute page sits in.
 *
 * The gallery itself is a fixed, full-bleed viewer with no chrome. These
 * pages are ordinary documents that scroll, so they need their own shell —
 * but they keep the same dark ground and glass vocabulary so signing in does
 * not feel like leaving the site for an admin panel.
 */
interface ShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}

/**
 * A document that scrolls: the dashboard, the admin tables, the apply form.
 */
export function ContributeShell(props: ShellProps) {
  return (
    <Frame
      {...props}
      className="relative mx-auto w-full max-w-3xl px-6 py-12 sm:py-16"
    />
  );
}

/**
 * A single thing to do, centred in the viewport.
 *
 * Sign-in is one field and one button; pinned to the top left of a 1440px
 * screen it read as an abandoned page. This was a `centred` boolean on
 * `ContributeShell` that exactly one caller ever passed — a flag in the API
 * of every page to serve one of them. Two names cost less than one flag.
 */
export function ContributeCard(props: ShellProps) {
  return (
    <Frame
      {...props}
      className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12"
    />
  );
}

function Frame({
  title,
  subtitle,
  children,
  action,
  className,
}: ShellProps & { className: string }) {
  return (
    <div className="min-h-dvh bg-surface text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(120% 70% at 50% 0%, oklch(100% 0 0 / 0.07), transparent 60%)",
        }}
      />
      <div className={className}>
        <header className="mb-10 flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <Link
              className={`${TOUCH_LINK} font-semibold text-white/50 text-sm tracking-[-0.03em] transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80`}
              href="/"
            >
              the beauty of earth.
            </Link>
            <h1 className="mt-2 font-semibold text-2xl tracking-[-0.04em] sm:text-3xl">
              {title}
            </h1>
            {subtitle === undefined ? null : (
              <p className="mt-2 max-w-prose text-balance text-white/60">
                {subtitle}
              </p>
            )}
          </div>
          {action}
        </header>
        <main>{children}</main>

        {/*
          Static, not fixed. The old footer was `fixed z-50`, so it floated
          over the viewer and over these pages as they scrolled.
        */}
        <footer className="mt-16 text-white/35 text-xs">
          ©{" "}
          {/*
            The last control on the site under the touch floor: 58x14, on
            every contribute page, at both widths. It is the only link in
            this footer rather than a link inside a sentence, so the
            exemption for prose does not cover it.
          */}
          <a
            className={`${TOUCH_LINK} transition-colors hover:text-white/70`}
            href="https://jomaendle.com"
            rel="noopener noreferrer"
            target="_blank"
          >
            Jo Mändle
          </a>
        </footer>
      </div>
    </div>
  );
}
