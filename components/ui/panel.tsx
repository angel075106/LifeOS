import type * as React from "react";
import { cn } from "@/lib/utils";

type PanelProps = Omit<React.ComponentProps<"section">, "title"> & {
  title?: React.ReactNode;
  /** Short supporting text under the title. */
  description?: React.ReactNode;
  /** Controls rendered on the right side of the header. */
  actions?: React.ReactNode;
  /** Padding inside the body. Defaults to "md". */
  padding?: "none" | "sm" | "md";
  headingLevel?: "h2" | "h3";
};

/** Card surface: the basic container for every section of a screen. */
export function Panel({
  title,
  description,
  actions,
  padding = "md",
  headingLevel: Heading = "h2",
  className,
  children,
  ...props
}: PanelProps) {
  return (
    <section
      className={cn("relative min-w-0 rounded-xl border border-border bg-surface shadow-card", className)}
      {...props}
    >
      {title || actions ? (
        <header className="flex min-h-12 items-center gap-3 border-b border-border px-4 py-2.5">
          {title ? (
            <div className="min-w-0 flex-1">
              <Heading className="truncate text-sm font-semibold text-fg">{title}</Heading>
              {description ? <p className="mt-0.5 text-xs text-fg-muted">{description}</p> : null}
            </div>
          ) : (
            <span className="flex-1" />
          )}
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn(padding === "md" && "p-4", padding === "sm" && "p-3")}>{children}</div>
    </section>
  );
}
