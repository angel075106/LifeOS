import { cn } from "@/lib/utils";

/** LifeOS mark: a ring with one filled quarter, like time already spent well. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7 text-accent", className)} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <circle cx="16" cy="16" r="8.25" fill="none" stroke="#ffffff" strokeWidth="2.5" />
      <path d="M16 16V7.75A8.25 8.25 0 0 1 24.25 16Z" fill="#ffffff" />
    </svg>
  );
}

export function Wordmark({ className, size = "md" }: { className?: string; size?: "md" | "lg" }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={size === "lg" ? "size-9" : "size-6"} />
      <span className={cn("font-semibold tracking-tight text-fg", size === "lg" ? "text-xl" : "text-[15px]")}>LifeOS</span>
    </span>
  );
}
