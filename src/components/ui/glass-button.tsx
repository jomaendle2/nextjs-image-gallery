import type { ButtonHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "icon";
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
        "bg-button-glass/80 border border-glass-border",
        "text-gallery-text font-medium",
        "transition-all duration-200 ease-out",
        "hover:bg-button-glass-hover active:scale-95",
        "disabled:opacity-50 disabled:pointer-events-none",
        "shadow-glass transform-gpu backdrop-blur-md",

        // Variants
        variant === "default" && "rounded-2xl",
        variant === "icon" && "rounded-full",

        // Sizes
        size === "default" && "px-6 py-3 text-sm",
        size === "icon" && "h-12 w-12",
        size === "sm" && "px-4 py-2 text-sm",

        className,
      )}
      ref={ref}
      type={type}
      {...props}
    />
  );
}
