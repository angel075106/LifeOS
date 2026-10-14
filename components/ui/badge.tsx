import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-[3px] border px-1.5 py-px font-mono text-[10px] font-medium uppercase tracking-[0.12em] [&_svg]:size-3",
  {
    variants: {
      variant: {
        neutral: "border-line-strong bg-panel-raised text-fg-muted",
        cyan: "border-cyan/40 bg-cyan/10 text-cyan-soft",
        income: "border-income/40 bg-income/10 text-income",
        expense: "border-expense/40 bg-expense/10 text-expense",
        warn: "border-warn/40 bg-warn/10 text-warn",
        scheduled: "border-dashed border-electric-soft/60 bg-electric/10 text-electric-soft",
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
