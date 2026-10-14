"use client";

import { cn } from "@/lib/utils";
import type { ThemePreference } from "@/lib/theme";
import { useTheme } from "./theme-controller";
import { THEME_OPTIONS } from "./theme-menu";

/** Miniature of each theme (fixed colors on purpose: it previews, not follows, the theme). */
const PREVIEW = {
  light: { canvas: "#f6f6f4", surface: "#ffffff", border: "#e6e5e1", fg: "#1c1b18", muted: "#d4d3ce" },
  dark: { canvas: "#121214", surface: "#19191c", border: "#2a2a2f", fg: "#ededef", muted: "#3a3a41" },
} as const;

function MiniWindow({ theme }: { theme: keyof typeof PREVIEW }) {
  const colors = PREVIEW[theme];
  return (
    <div className="h-full w-full p-2" style={{ backgroundColor: colors.canvas }}>
      <div
        className="flex h-full flex-col gap-1.5 rounded-md p-2"
        style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}
      >
        <span className="h-1.5 w-2/5 rounded-full" style={{ backgroundColor: colors.fg }} />
        <span className="h-1.5 w-3/5 rounded-full" style={{ backgroundColor: colors.muted }} />
        <span className="mt-auto h-2.5 w-1/4 rounded-sm" style={{ backgroundColor: "#5b5bd6" }} />
      </div>
    </div>
  );
}

function ThemePreview({ preference }: { preference: ThemePreference }) {
  if (preference !== "system") return <MiniWindow theme={preference} />;
  return (
    <div className="grid h-full grid-cols-2">
      <div className="overflow-hidden">
        <div className="h-full w-[200%]">
          <MiniWindow theme="light" />
        </div>
      </div>
      <div className="overflow-hidden">
        <div className="-ml-[100%] h-full w-[200%]">
          <MiniWindow theme="dark" />
        </div>
      </div>
    </div>
  );
}

/** Theme choice for Settings: native radio buttons (arrow keys, screen readers) styled as cards. */
export function ThemeSelector() {
  const { preference, setPreference } = useTheme();
  return (
    <fieldset className="grid gap-2.5">
      <legend className="mb-2.5 text-[13px] font-medium text-fg">Theme</legend>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
          <label
            key={value}
            className={cn(
              "grid cursor-pointer gap-2 rounded-xl border border-border bg-surface p-1.5 transition-colors hover:border-border-strong",
              "has-checked:border-accent has-checked:shadow-[0_0_0_1px_var(--accent)]",
              "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus",
            )}
          >
            <input
              type="radio"
              name="theme-preference"
              value={value}
              checked={preference === value}
              onChange={() => setPreference(value)}
              className="sr-only"
            />
            <span className="block h-16 overflow-hidden rounded-lg border border-border sm:h-20" aria-hidden="true">
              <ThemePreview preference={value} />
            </span>
            <span className="flex items-center gap-1.5 px-1 pb-0.5 text-[13px] font-medium text-fg">
              <Icon className="size-3.5 text-fg-muted" aria-hidden="true" />
              {label}
            </span>
          </label>
        ))}
      </div>
      <p className="text-xs text-fg-muted">
        System follows your device&apos;s light or dark setting. The choice is saved on this device.
      </p>
    </fieldset>
  );
}
