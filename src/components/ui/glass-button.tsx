import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "icon";
  size?: "default" | "icon" | "sm";
}

const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
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
          "shadow-glass transform-gpu",

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
        style={{
          willChange: "transform, backdrop-filter",
          isolation: "isolate",
          WebkitBackdropFilter: "blur(12px)",
          backdropFilter: "blur(12px)",
          contain: "layout style paint",
        }}
        {...props}
      />
    );
  },
);

GlassButton.displayName = "GlassButton";

export { GlassButton };
