import { ArrowDownRight, ArrowUpRight, Equal } from "lucide-react";
import { formatMoney, type Currency } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Category color swatch with its name (color is never the only cue). */
export function CategoryChip({
  name,
  color,
  archived = false,
  className,
}: {
  name: string;
  color: string;
  archived?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-xs text-fg-muted", className)}>
      <span
        className="size-2 shrink-0 rounded-full ring-1 ring-fg/10"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className="truncate">{name}</span>
      {archived ? <span className="text-fg-subtle">(archived)</span> : null}
    </span>
  );
}

type MoneyKind = "income" | "expense" | "net" | "plain";

/**
 * Money amount with direction shown three ways: sign, arrow icon and color.
 * income -> "+€12.00" (green, up arrow); expense -> "−€12.00" (red, down arrow);
 * net -> sign of the value; plain -> no decoration.
 */
export function MoneyAmount({
  minor,
  currency,
  kind = "plain",
  showIcon = true,
  className,
}: {
  minor: number;
  currency: Currency;
  kind?: MoneyKind;
  showIcon?: boolean;
  className?: string;
}) {
  const direction =
    kind === "income" ? 1 : kind === "expense" ? -1 : kind === "net" ? Math.sign(minor) : 0;
  const absolute = Math.abs(minor);
  const formatted = formatMoney(absolute, currency);
  const sign = direction > 0 ? "+" : direction < 0 ? "−" : "";
  const Icon = direction > 0 ? ArrowUpRight : direction < 0 ? ArrowDownRight : Equal;
  const label =
    kind === "income"
      ? `income ${formatted}`
      : kind === "expense"
        ? `expense ${formatted}`
        : kind === "net"
          ? `net ${direction < 0 ? "minus " : ""}${formatted}`
          : formatted;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap tabular-nums",
        direction > 0 && kind !== "plain" && "text-income",
        direction < 0 && kind !== "plain" && "text-expense",
        className,
      )}
      aria-label={label}
    >
      {showIcon && kind !== "plain" ? <Icon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
      <span aria-hidden="true">
        {sign}
        {formatted}
      </span>
    </span>
  );
}
