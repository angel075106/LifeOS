import type * as React from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  className,
}: {
  title: string;
  eyebrow?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-end gap-x-4 gap-y-3", className)}>
      <div className="min-w-0 flex-1">
        {eyebrow ? <p className="hud-label mb-1 text-cyan">{eyebrow}</p> : null}
        <h1 className="text-xl font-semibold text-fg md:text-2xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-fg-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
