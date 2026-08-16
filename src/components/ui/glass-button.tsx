import type { ButtonHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "danger" | "arm" | "icon";
  size?: "default" | "icon" | "sm";
  ref?: Ref<HTMLButtonElement>;
}

const GLASS_BASE = cn(
  "relative inline-flex items-center justify-center",
  "glass-thin text-white font-medium",
  "transition-[scale,background-color] duration-300 ease-glass",
  "hover:bg-[var(--glass-fill-hover)] active:scale-95",
  "disabled:opacity-50 disabled:pointer-events-none",
);

/**
 * The look, separated from the element.
 *
 * Three places need a glass control that is not a `<button>`: an anchor
 * cannot be nested inside one, and two of the carousel's own controls render
 * links. All three had copied this class run character for character, which
 * is four copies of a hover colour and an easing curve waiting to disagree.
 *
 * Reach for `GlassButton` first. Use this only where the element genuinely
 * cannot be a button, and say why at the call site.
 */
export function glassControl(
  extra?: string,
  shape: "round" | "pill" = "pill",
): string {
  return cn(
    GLASS_BASE,
    shape === "round" ? "rounded-full" : "rounded-2xl",
    extra,
  );
}

export function GlassButton({
  className,
  variant = "default",
  size = "default",
  type = "button",
  ref,
  ...props
}: GlassButtonProps) {
  return (
    <button
      className={cn(
        GLASS_BASE,

        // Variants
        variant === "default" && "rounded-2xl",
        /*
         * The one action a page was opened to take.
         *
         * A page of identical glass buttons makes the reader find the
         * primary one by reading all of them. This is the only place the
         * accent is allowed to fill a surface, and there is at most one per
         * view — the moment there are two, neither is primary.
         */
        variant === "primary" &&
          "rounded-2xl border-accent-edge bg-accent-fill text-accent-bright hover:bg-accent-fill-hover",
        /*
         * The armed destructive action: the one that goes through.
         *
         * This class run was copied verbatim into three files, which is
         * three chances for the one control that cannot be undone to stop
         * looking like itself.
         */
        variant === "danger" &&
          "rounded-2xl border-danger-edge bg-danger-fill text-danger hover:bg-danger-fill-hover",
        /*
         * The step before it. Quiet until hovered, because arming a delete
         * should not shout from a row of ordinary buttons — it is the
         * confirmation that carries the weight, not the thing that opens it.
         */
        variant === "arm" && "rounded-2xl text-white/60 hover:text-danger",
        variant === "icon" && "rounded-full",

        // Sizes
        // min-h-11 is the 44px touch floor; without it the small size came
        // out at 38px and every control on the contribute pages was under it.
        size === "default" && "min-h-12 px-6 py-3 text-sm",
        size === "icon" && "h-12 w-12",
        size === "sm" && "min-h-11 px-4 py-2 text-sm",

        className,
      )}
      ref={ref}
      type={type}
      {...props}
    />
  );
}
