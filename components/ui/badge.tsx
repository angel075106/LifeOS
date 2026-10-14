import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-px text-[11px] font-medium leading-4 [&_svg]:size-3",
  {
    variants: {
      variant: {
        neutral: "border-transparent bg-muted text-fg-muted",
        accent: "border-transparent bg-accent-soft text-accent-text",
        income: "border-transparent bg-income-soft text-income",
        expense: "border-transparent bg-expense-soft text-expense",
        warn: "border-transparent bg-warning-soft text-warning",
        /** Planned (not yet done) activities: dashed outline instead of a fill. */
        scheduled: "border-dashed border-accent/60 bg-transparent text-accent-text",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

type BadgeProps = React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
