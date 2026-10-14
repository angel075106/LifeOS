import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg border font-medium transition-[background-color,border-color,color,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /** Main action of a view or dialog. */
        primary: "border-transparent bg-accent text-accent-fg shadow-card hover:bg-accent-hover",
        secondary: "border-border-strong bg-surface text-fg shadow-card hover:bg-muted",
        ghost: "border-transparent bg-transparent text-fg-muted hover:bg-muted hover:text-fg",
        danger: "border-transparent bg-danger text-white shadow-card hover:bg-danger-hover",
        /** Tinted shortcuts (e.g. quick add): accent, income and expense. */
        soft: "border-transparent bg-accent-soft text-accent-text hover:border-accent/40",
        income: "border-transparent bg-income-soft text-income hover:border-income/40",
        expense: "border-transparent bg-expense-soft text-expense hover:border-expense/40",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-10 px-3.5 text-sm md:h-9",
        lg: "h-11 px-5 text-sm",
        icon: "size-10 md:size-9",
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
