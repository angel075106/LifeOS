import { ChevronDown } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

/** Shared look for text-like controls. 16px text on mobile prevents iOS focus zoom. */
export const controlClass =
  "w-full rounded-hud border border-line-strong bg-base/80 px-3 text-base text-fg placeholder:text-fg-subtle transition-colors hover:border-fg-subtle focus-visible:border-cyan focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-cyan/70 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-expense md:text-sm";

function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return <input type={type} className={cn(controlClass, "h-10", className)} {...props} />;
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(controlClass, "min-h-20 py-2 leading-relaxed", className)} {...props} />;
}

/** Native select (best experience on iPhone) with HUD styling. */
function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cn(controlClass, "h-10 appearance-none pr-9", className)} {...props}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted"
        aria-hidden="true"
      />
    </div>
  );
}

export { Input, Select, Textarea };
