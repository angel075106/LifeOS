import { AlertCircle, Loader2, RotateCw } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

/** Placeholder shimmer for loading content. Hidden from assistive technology. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("animate-pulse rounded-md bg-muted-strong motion-reduce:animate-none", className)} />
  );
}

export function Spinner({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-2 text-fg-muted", className)}>
      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

type EmptyStateProps = {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-strong px-4 py-8 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-muted text-fg-subtle [&_svg]:size-5">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-medium text-fg">{title}</p>
      {description ? <p className="max-w-sm text-[13px] text-fg-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Inline error block for failed loads, with an optional retry action. */
export function ErrorState({
  title = "Couldn't load data",
  message,
  onRetry,
  className,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn("flex items-start gap-3 rounded-xl border border-expense/25 bg-expense-soft px-4 py-3 text-sm", className)}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-expense" aria-hidden="true" />
      <div className="grid min-w-0 flex-1 gap-1">
        <p className="font-medium text-expense">{title}</p>
        <p className="text-fg-muted">{message}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-md text-[13px] font-medium text-fg underline-offset-4 hover:underline"
          >
            <RotateCw className="size-3.5" aria-hidden="true" />
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}
