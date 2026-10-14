import { cn } from "@/lib/utils";

/** LifeOS mark: a targeting reticle around a core, drawn with thin HUD strokes. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden="true" fill="none">
      <circle cx="16" cy="16" r="11" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.25" />
      <path d="M16 3v5M16 24v5M3 16h5M24 16h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8.2 8.2l2.4 2.4M21.4 21.4l2.4 2.4" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1.25" />
      <rect x="12" y="12" width="8" height="8" rx="1.5" transform="rotate(45 16 16)" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-cyan", className)}>
      <LogoMark />
      <span className="font-mono text-sm font-semibold tracking-[0.3em] text-fg">
        LIFE<span className="text-cyan">OS</span>
      </span>
    </span>
  );
}
