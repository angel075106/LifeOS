"use client";

import { Check } from "lucide-react";
import { CATEGORY_PALETTE } from "@/features/categories/schema";
import { cn } from "@/lib/utils";

/** Preset swatches (radio group) plus a native picker for any custom color. */
export function ColorPicker({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}) {
  const normalized = value.toLowerCase();
  const isCustom = !CATEGORY_PALETTE.includes(normalized as (typeof CATEGORY_PALETTE)[number]);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="radiogroup" aria-label="Color" className="flex flex-wrap gap-1.5">
        {CATEGORY_PALETTE.map((color) => {
          const selected = normalized === color;
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={color}
              disabled={disabled}
              onClick={() => onChange(color)}
              className={cn(
                "flex size-7 items-center justify-center rounded-full ring-1 ring-white/15 transition-transform hover:scale-110 disabled:opacity-50",
                selected && "ring-2 ring-fg",
              )}
              style={{ backgroundColor: color }}
            >
              {selected ? <Check className="size-3.5 text-void" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
      <label
        htmlFor={id}
        className={cn(
          "relative inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-line-strong px-2 text-xs text-fg-muted hover:text-fg",
          isCustom && "border-fg text-fg",
        )}
      >
        <span className="size-3.5 rounded-full ring-1 ring-white/20" style={{ backgroundColor: value }} aria-hidden="true" />
        Custom
        <input
          id={id}
          type="color"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value.toLowerCase())}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}
