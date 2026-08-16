import type { ButtonHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "icon";
  size?: "default" | "icon" | "sm";
  ref?: Ref<HTMLButtonElement>;
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
        // Base styles
        "relative inline-flex items-center justify-center",
        "glass-thin text-white font-medium",
        "transition-[scale,background-color] duration-300 ease-glass",
        "hover:bg-[var(--glass-fill-hover)] active:scale-95",
        "disabled:opacity-50 disabled:pointer-events-none",

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
