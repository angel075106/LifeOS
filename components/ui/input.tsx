import { ChevronDown } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Shared look for text-like controls. The border keeps 3:1 contrast against surfaces so the
 * field stays identifiable; 16px text on phones prevents the iOS focus zoom.
 */
export const controlClass =
  "w-full min-w-0 rounded-lg border border-input bg-surface px-3 text-base text-fg shadow-card placeholder:text-fg-subtle transition-[border-color,box-shadow] hover:border-fg-subtle focus-visible:border-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-expense aria-invalid:focus-visible:ring-expense/25 md:text-sm";

function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return <input type={type} className={cn(controlClass, "h-10 md:h-9", className)} {...props} />;
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(controlClass, "min-h-20 py-2 leading-relaxed", className)} {...props} />;
}

/** Native select (best experience on iPhone), styled like the other controls. */
function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cn(controlClass, "h-10 appearance-none pr-9 md:h-9", className)} {...props}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle"
        aria-hidden="true"
      />
    </div>
  );
}

export { Input, Select, Textarea };
