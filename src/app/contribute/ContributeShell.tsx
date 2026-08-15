import Link from "next/link";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { EnvironmentBanner } from "@/components/ui/EnvironmentBanner";
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
  /**
   * The page one level up, when there is one.
   *
   * The wordmark always goes to the gallery, which answers "how do I leave"
   * but not "how do I go back". Those are different questions once a page
   * is two levels deep: the admin tables are reached from your own
   * photographs, and without this the only way out of them is to leave the
   * whole section and walk in again.
   */
  back?: { href: string; label: string };
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
  back,
  className,
}: ShellProps & { className: string }) {
  return (
    <div className="min-h-dvh bg-surface text-white">
      <EnvironmentBanner />
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
            {/*
              A trail, not a single link. `aria-label` names it so a screen
              reader announces the region rather than two anonymous links,
              and the separator is decorative — it is punctuation between
              names, and reading it aloud adds nothing.
            */}
            <nav
              aria-label="Breadcrumb"
              className="flex flex-wrap items-baseline gap-x-2 text-sm"
            >
              <Link
                className={`${TOUCH_LINK} font-semibold text-white/50 tracking-[-0.03em] transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80`}
                href="/"
              >
                the beauty of earth.
              </Link>
              {back === undefined ? null : (
                <>
                  <span aria-hidden="true" className="text-white/25">
                    /
                  </span>
                  <Link
                    className={`${TOUCH_LINK} text-white/50 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80`}
                    href={back.href}
                  >
                    {back.label}
                  </Link>
                </>
              )}
            </nav>
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

        <SiteFooter className="mt-16" />
      </div>
    </div>
  );
}
