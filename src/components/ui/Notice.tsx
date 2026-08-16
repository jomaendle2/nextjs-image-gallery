import { AlertTriangle, CheckCircle2, type Info } from "lucide-react";
import type { ReactNode } from "react";

/**
 * A message that says what kind of message it is.
 *
 * Everything used to arrive in the same neutral glass box: a confirmation, a
 * warning, and "that link has expired" were typographically identical, so
 * the only thing distinguishing good news from bad was reading it. On a
 * phone, glanced at, they were the same object.
 *
 * Three tones, and the restraint is the point on a site whose whole surface
 * is photographs. Colour is carried by a tinted hairline and an icon rather
 * than a filled panel, so a warning reads as a warning without becoming the
 * loudest thing on a page that exists to show somebody's work.
 *
 * `role="alert"` only for errors. A warning that interrupts a screen reader
 * mid-sentence to announce something the person has not acted on yet is
 * worse than one they reach in reading order.
 */

type Tone = "error" | "warning" | "success";

const TONES: Record<
  Tone,
  { border: string; text: string; icon: typeof Info; label: string }
> = {
  error: {
    border: "border-red-400/30 bg-red-500/[0.07]",
    text: "text-red-100/90",
    icon: AlertTriangle,
    label: "Error",
  },
  warning: {
    border: "border-amber-400/30 bg-amber-400/[0.07]",
    text: "text-amber-100/90",
    icon: AlertTriangle,
    label: "Warning",
  },
  success: {
    border: "border-emerald-400/30 bg-emerald-400/[0.07]",
    text: "text-emerald-100/90",
    icon: CheckCircle2,
    label: "Done",
  },
};

export function Notice({
  tone = "warning",
  children,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  const { border, text, icon: Icon, label } = TONES[tone];

  return (
    <div
      className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm ${border} ${text} ${className}`}
      /*
        Errors interrupt; everything else waits for a pause. Without the
        polite region a success or warning was never announced at all — and
        for the invite form, the result of the action is the only feedback
        that anything happened.
      */
      {...(tone === "error"
        ? { role: "alert" }
        : { "aria-live": "polite" as const })}
    >
      <Icon aria-hidden="true" className="mt-0.5 shrink-0" size={15} />
      {/*
        The tone is visible but not audible, so it is named for a screen
        reader here rather than left to colour alone — which is also the
        WCAG requirement, not just good manners.
      */}
      <span className="sr-only">{label}:</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
