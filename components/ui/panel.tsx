import type * as React from "react";
import { cn } from "@/lib/utils";

type PanelProps = Omit<React.ComponentProps<"section">, "title"> & {
  title?: React.ReactNode;
  /** Two-digit mono index shown before the title, e.g. "01". */
  index?: string;
  /** Controls rendered on the right side of the header. */
  actions?: React.ReactNode;
  /** Padding inside the body. Defaults to "md". */
  padding?: "none" | "sm" | "md";
  headingLevel?: "h2" | "h3";
};

/** Dark slate surface with thin technical border and corner brackets. */
export function Panel({
  title,
  index,
  actions,
  padding = "md",
  headingLevel: Heading = "h2",
  className,
  children,
  ...props
}: PanelProps) {
  return (
    <section
      className={cn("hud-corners relative min-w-0 rounded-lg border border-line bg-panel/85 backdrop-blur-sm", className)}
      {...props}
    >
      {title || actions ? (
        <header className="flex min-h-12 items-center gap-3 border-b border-line px-4 py-2.5">
          {title ? (
            <Heading className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold text-fg">
              {index ? <span className="font-mono text-[11px] font-normal text-cyan">{index}</span> : null}
              <span className="truncate">{title}</span>
            </Heading>
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
