"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  icon?: React.ReactNode;
  /** Extra classes applied when this option is selected (e.g. income/expense tint). */
  activeClassName?: string;
};

type SegmentedControlProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<SegmentOption<T>>;
  /** Accessible name of the group. */
  label: string;
  size?: "sm" | "md";
  className?: string;
  disabled?: boolean;
  /** Show only icons below the sm breakpoint (labels remain available to screen readers). */
  compactOnMobile?: boolean;
};

/** Single-choice control following the WAI-ARIA radio group pattern (arrow-key navigation). */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
  className,
  disabled,
  compactOnMobile = false,
}: SegmentedControlProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function move(from: number, delta: number) {
    const next = (from + delta + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex gap-0.5 rounded-lg bg-muted-strong/60 p-0.5", className)}>
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                move(index, 1);
              } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                move(index, -1);
              }
            }}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent font-medium text-fg-muted transition-colors hover:text-fg disabled:opacity-50 [&_svg]:size-3.5",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3 text-sm md:h-8",
              selected && "border-border-strong bg-segment text-fg shadow-card",
              selected && option.activeClassName,
            )}
          >
            {option.icon}
            <span className={compactOnMobile && option.icon ? "max-sm:sr-only" : undefined}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
