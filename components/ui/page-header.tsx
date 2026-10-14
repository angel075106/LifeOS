import type * as React from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex flex-wrap items-end gap-x-4 gap-y-3", className)}>
      {/* Full width on phones so the actions wrap below the title instead of squeezing it. */}
      <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
        <h1 className="text-xl font-semibold tracking-tight text-fg md:text-2xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-fg-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
