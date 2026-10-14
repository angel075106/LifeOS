import { ArrowDownRight, ArrowUpRight, CalendarClock, CheckCircle2, CornerDownRight, CornerLeftUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatClockTime, formatDuration } from "@/lib/dates";
import type { Activity, ActivityCategory, FinanceCategory, Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CategoryChip, MoneyAmount } from "./display";

const rowClass =
  "w-full rounded-hud border border-line bg-base/50 px-3 py-2 text-left transition-colors hover:border-line-strong hover:bg-panel-hover";

export function ActivityRow({
  activity,
  category,
  timeZone,
  onOpen,
  continuesBefore = false,
  continuesAfter = false,
}: {
  activity: Activity;
  category: ActivityCategory | undefined;
  timeZone: string;
  onOpen: (activity: Activity) => void;
  continuesBefore?: boolean;
  continuesAfter?: boolean;
}) {
  const scheduled = activity.status === "scheduled";
  const start = formatClockTime(activity.startMs, timeZone);
  const end = formatClockTime(activity.endMs, timeZone);
  const duration = formatDuration((activity.endMs - activity.startMs) / 60_000);

  return (
    <button
      type="button"
      onClick={() => onOpen(activity)}
      className={cn(rowClass, "grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3")}
      aria-label={`Edit ${activity.title}, ${start} to ${end}, ${duration}${scheduled ? ", scheduled" : ""}`}
    >
      <span className="font-mono text-xs leading-5 text-fg-muted" aria-hidden="true">
        {start}
        <br />
        {end}
      </span>
      <span className="grid min-w-0 gap-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-fg">{activity.title}</span>
          <span className="ml-auto shrink-0 font-mono text-xs text-cyan-soft">{duration}</span>
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {category ? <CategoryChip name={category.name} color={category.color} archived={category.isArchived} /> : null}
          {scheduled ? (
            <Badge variant="scheduled">
              <CalendarClock aria-hidden="true" />
              Scheduled
            </Badge>
          ) : (
            <Badge variant="neutral">
              <CheckCircle2 aria-hidden="true" />
              Done
            </Badge>
          )}
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
}: {
  transaction: Transaction;
  category: FinanceCategory | undefined;
  onOpen: (transaction: Transaction) => void;
  showDate?: boolean;
}) {
  const income = transaction.type === "income";
  const label = transaction.description ?? category?.name ?? (income ? "Income" : "Expense");
  return (
    <button
      type="button"
      onClick={() => onOpen(transaction)}
      className={cn(rowClass, "flex items-center gap-3")}
      aria-label={`Edit ${transaction.type}: ${label}`}
    >
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full border",
          income ? "border-income/40 bg-income/10 text-income" : "border-expense/40 bg-expense/10 text-expense",
        )}
        aria-hidden="true"
      >
        {income ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="truncate text-sm text-fg">{label}</span>
        <span className="flex flex-wrap items-center gap-x-2 text-xs text-fg-subtle">
          {category ? <CategoryChip name={category.name} color={category.color} archived={category.isArchived} /> : null}
          {showDate ? <span className="font-mono">{transaction.occurredOn}</span> : null}
        </span>
      </span>
      <MoneyAmount
        minor={transaction.amountMinor}
        currency={transaction.currency}
        kind={transaction.type}
        showIcon={false}
        className="text-sm"
      />
    </button>
  );
}
