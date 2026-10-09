import * as React from "react";
import { cn } from "@/lib/utils";

// Note: cva is tiny; inline cva alternative using map to avoid adding another dep
type VariantFn = (props?: any) => string;
function cvaFactory(base: string, variants?: Record<string, Record<string, string>>, defaults?: Record<string, string>): VariantFn {
  return (props: Record<string, string | undefined> = {}) => {
    const classes = [base];
    if (variants) {
      for (const [k, map] of Object.entries(variants)) {
        const v = props[k] ?? defaults?.[k];
        if (v && map[v]) classes.push(map[v]);
      }
    }
    return classes.join(" ");
  };
}

const buttonVariants = cvaFactory(
  "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap",
  {
    variant: {
      primary:
        "bg-apron-gold text-apron-bg-dark shadow-gold hover:bg-apron-goldDark",
      secondary: "bg-apron-pink text-white hover:bg-apron-pinkDark",
      outline:
        "border border-white/30 text-white bg-white/5 hover:bg-white/10",
      ghost: "text-white/90 hover:bg-white/10",
      danger: "bg-red-500 text-white hover:bg-red-600",
    },
    size: {
      xs: "h-8 px-2.5 text-xs",
      sm: "h-9 px-3 text-sm",
      md: "h-11 px-5 text-sm",
      lg: "h-14 px-7 text-base",
      icon: "h-11 w-11",
    },
  },
  {
    variant: "primary",
    size: "md",
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "xs" | "sm" | "md" | "lg" | "icon";
  loading?: boolean;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, loading, children, disabled, ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={loading || disabled}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {loading ? (
          <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
        ) : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
