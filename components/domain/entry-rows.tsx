import { ArrowDownRight, ArrowUpRight, CalendarClock, CornerDownRight, CornerLeftUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatClockTime, formatDuration, formatLocalDate } from "@/lib/dates";
import type { Activity, ActivityCategory, FinanceCategory, Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CategoryChip, MoneyAmount } from "./display";

// Inset focus ring: rows often sit inside scrolling lists that would clip an outer outline.
const rowClass = "w-full rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted focus-visible:-outline-offset-2";

export function ActivityRow({
  activity,
  category,
  timeZone,
  onOpen,
  continuesBefore = false,
  continuesAfter = false,
  compact = false,
}: {
  activity: Activity;
  category: ActivityCategory | undefined;
  timeZone: string;
  onOpen: (activity: Activity) => void;
  continuesBefore?: boolean;
  continuesAfter?: boolean;
  /** One line per activity (agenda lists); the full layout shows category and status chips. */
  compact?: boolean;
}) {
  const scheduled = activity.status === "scheduled";
  const start = formatClockTime(activity.startMs, timeZone);
  const end = formatClockTime(activity.endMs, timeZone);
  const duration = formatDuration((activity.endMs - activity.startMs) / 60_000);
  const label = `Edit ${activity.title}, ${start} to ${end}, ${duration}${scheduled ? ", scheduled" : ""}`;

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => onOpen(activity)}
        className={cn(rowClass, "flex items-center gap-2.5 py-1.5")}
        aria-label={label}
      >
        <span className="w-[5.6rem] shrink-0 text-xs tabular-nums text-fg-muted" aria-hidden="true">
          {start}–{end}
        </span>
        <span
          className={cn("h-4 w-[3px] shrink-0 rounded-full", scheduled && "opacity-50")}
          style={{ backgroundColor: category?.color ?? "var(--border-strong)" }}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate text-sm" aria-hidden="true">
          <span className="font-medium text-fg">{activity.title}</span>
          {category ? <span className="text-fg-subtle"> · {category.name}</span> : null}
        </span>
        {continuesBefore ? <CornerLeftUp className="size-3.5 shrink-0 text-fg-subtle" aria-hidden="true" /> : null}
        {continuesAfter ? <CornerDownRight className="size-3.5 shrink-0 text-fg-subtle" aria-hidden="true" /> : null}
        {scheduled ? <CalendarClock className="size-3.5 shrink-0 text-accent-text" aria-hidden="true" /> : null}
        <span className="shrink-0 text-xs tabular-nums text-fg-muted" aria-hidden="true">
          {duration}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(activity)}
      className={cn(rowClass, "grid grid-cols-[3rem_3px_minmax(0,1fr)] gap-x-3")}
      aria-label={label}
    >
      <span className="text-xs leading-5 tabular-nums" aria-hidden="true">
        <span className="block text-fg">{start}</span>
        <span className="block text-fg-subtle">{end}</span>
      </span>
      <span
        className={cn("my-0.5 rounded-full", scheduled && "opacity-50")}
        style={{ backgroundColor: category?.color ?? "var(--border-strong)" }}
        aria-hidden="true"
      />
      <span className="grid min-w-0 gap-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-fg">{activity.title}</span>
          <span className="ml-auto shrink-0 text-xs tabular-nums text-fg-muted">{duration}</span>
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {category ? <CategoryChip name={category.name} color={category.color} archived={category.isArchived} /> : null}
          {scheduled ? (
            <Badge variant="scheduled">
              <CalendarClock aria-hidden="true" />
              Scheduled
            </Badge>
          ) : null}
          {continuesBefore ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-fg-subtle">
              <CornerLeftUp className="size-3" aria-hidden="true" />
              from previous day
            </span>
          ) : null}
          {continuesAfter ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-fg-subtle">
              <CornerDownRight className="size-3" aria-hidden="true" />
              continues
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}

export function TransactionRow({
  transaction,
  category,
  onOpen,
  showDate = false,
  compact = false,
}: {
  transaction: Transaction;
  category: FinanceCategory | undefined;
  onOpen: (transaction: Transaction) => void;
  showDate?: boolean;
  /** Tighter spacing for agenda lists. */
  compact?: boolean;
}) {
  const income = transaction.type === "income";
  const label = transaction.description ?? category?.name ?? (income ? "Income" : "Expense");
  return (
    <button
      type="button"
      onClick={() => onOpen(transaction)}
      className={cn(rowClass, "flex items-center gap-3", compact && "gap-2.5 py-1.5")}
      aria-label={`Edit ${transaction.type}: ${label}`}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full",
          compact ? "size-7" : "size-8",
          income ? "bg-income-soft text-income" : "bg-expense-soft text-expense",
        )}
        aria-hidden="true"
      >
        {income ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="truncate text-sm font-medium text-fg">{label}</span>
        <span className="flex flex-wrap items-center gap-x-2 text-xs text-fg-muted">
          {category ? <CategoryChip name={category.name} color={category.color} archived={category.isArchived} /> : null}
          {showDate ? (
            <time dateTime={transaction.occurredOn} className="tabular-nums text-fg-subtle">
              {formatLocalDate(transaction.occurredOn, { weekday: "short", day: "numeric", month: "short" })}
            </time>
          ) : null}
        </span>
      </span>
      <MoneyAmount
        minor={transaction.amountMinor}
        currency={transaction.currency}
        kind={transaction.type}
        showIcon={false}
        className="text-sm font-medium"
      />
    </button>
  );
}
