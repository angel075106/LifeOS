import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-hud border font-medium transition-[background-color,border-color,color,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "border-cyan/60 bg-cyan/12 text-cyan-soft hover:border-cyan hover:bg-cyan/20 hover:hud-glow",
        solid: "border-cyan bg-cyan text-void hover:border-cyan-soft hover:bg-cyan-soft",
        secondary: "border-line-strong bg-panel-raised text-fg hover:border-fg-subtle hover:bg-panel-hover",
        ghost: "border-transparent bg-transparent text-fg-muted hover:bg-panel-hover hover:text-fg",
        danger: "border-expense/60 bg-expense/10 text-expense hover:border-expense hover:bg-expense/20",
        income: "border-income/50 bg-income/10 text-income hover:border-income hover:bg-income/20",
        expense: "border-expense/50 bg-expense/10 text-expense hover:border-expense hover:bg-expense/20",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-11 px-5 text-sm",
        icon: "size-10",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Shows a spinner, disables the button and announces the busy state. */
    loading?: boolean;
  };

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  if (asChild) {
    return (
      <Slot className={cn(buttonVariants({ variant, size, className }))} {...props}>
        {children}
      </Slot>
    );
  }
  return (
    <button
      // Defaults to "button" so buttons inside forms never submit by accident.
      type={type}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export { Button, buttonVariants };
