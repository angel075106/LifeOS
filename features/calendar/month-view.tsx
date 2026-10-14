"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { currenciesIn } from "@/features/finance/calc";
import {
  addDays,
  addMonths,
  dayOfWeek,
  formatDuration,
  formatLocalDate,
  isSameMonth,
  startOfWeek,
  type LocalDate,
  type WeekStart,
} from "@/lib/dates";
import type { ActivityCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { DaySummary } from "./day-index";
import { compactMoney, describeDay } from "./day-labels";

const MAX_LINES = 2;
const MAX_DOTS = 4;
const FALLBACK_COLOR = "var(--fg-subtle)";

type MonthViewProps = {
  weeks: LocalDate[][];
  anchor: LocalDate;
  selected: LocalDate;
  today: LocalDate;
  weekStartsOn: WeekStart;
  index: Map<LocalDate, DaySummary>;
  categories: Map<string, ActivityCategory>;
  loading: boolean;
  onSelect: (date: LocalDate) => void;
  labelledBy: string;
};

/** Keyboard model from the WAI-ARIA date grid pattern. */
function keyTarget(key: string, date: LocalDate, weekStartsOn: WeekStart): LocalDate | null {
  switch (key) {
    case "ArrowLeft":
      return addDays(date, -1);
    case "ArrowRight":
      return addDays(date, 1);
    case "ArrowUp":
      return addDays(date, -7);
    case "ArrowDown":
      return addDays(date, 7);
    case "Home":
      return startOfWeek(date, weekStartsOn);
    case "End":
      return addDays(startOfWeek(date, weekStartsOn), 6);
    case "PageUp":
      return addMonths(date, -1);
    case "PageDown":
      return addMonths(date, 1);
    default:
      return null;
  }
}

export function MonthView({
  weeks,
  anchor,
  selected,
  today,
  weekStartsOn,
  index,
  categories,
  loading,
  onSelect,
  labelledBy,
}: MonthViewProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const focusPending = useRef(false);

  // After keyboard navigation, move focus to the newly selected day (possibly a new month).
  useEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${selected}"]`)?.focus();
  }, [selected, weeks]);

  const weekdayNames = weeks[0].map((date) => ({
    short: formatLocalDate(date, { weekday: "short" }),
    long: formatLocalDate(date, { weekday: "long" }),
    weekend: dayOfWeek(date) === 0 || dayOfWeek(date) === 6,
  }));

  return (
    <div
      ref={gridRef}
      role="grid"
      aria-labelledby={labelledBy}
      aria-busy={loading}
      className={cn("select-none transition-opacity", loading && "opacity-60")}
      onKeyDown={(event) => {
        const target = keyTarget(event.key, selected, weekStartsOn);
        if (!target) return;
        event.preventDefault();
        focusPending.current = true;
        onSelect(target);
      }}
    >
      <div role="row" className="grid grid-cols-7 border-b border-border">
        {weekdayNames.map((name) => (
          <div
            key={name.long}
            role="columnheader"
            aria-label={name.long}
            className={cn("py-2 text-center text-xs font-medium", name.weekend ? "text-fg-subtle" : "text-fg-muted")}
          >
            {name.short}
          </div>
        ))}
      </div>
      {weeks.map((week) => (
        <div role="row" key={week[0]} className="grid grid-cols-7 border-b border-border last:border-b-0">
          {week.map((date) => {
            const summary = index.get(date);
            const inMonth = isSameMonth(date, anchor);
            const isToday = date === today;
            const isSelected = date === selected;
            return (
              <div
                role="gridcell"
                key={date}
                aria-selected={isSelected}
                className="@container min-w-0 border-r border-border last:border-r-0"
              >
                <button
                  type="button"
                  data-date={date}
                  tabIndex={isSelected ? 0 : -1}
                  aria-label={describeDay(date, summary, { today: isToday, selected: isSelected })}
                  aria-current={isToday ? "date" : undefined}
                  onClick={() => onSelect(date)}
                  className={cn(
                    "relative flex h-full min-h-[4.25rem] w-full flex-col gap-1 p-1 text-left transition-colors focus-visible:-outline-offset-2 sm:min-h-24 sm:p-1.5 lg:min-h-[6.5rem]",
                    inMonth ? "hover:bg-muted/70" : "bg-muted/50 hover:bg-muted",
                    isSelected && "bg-accent-soft/70 shadow-[inset_0_0_0_1.5px_var(--accent)] hover:bg-accent-soft",
                  )}
                >
                  <DayNumber date={date} inMonth={inMonth} isToday={isToday} isSelected={isSelected} />
                  {summary ? <CellContent summary={summary} categories={categories} /> : null}
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function DayNumber({
  date,
  inMonth,
  isToday,
  isSelected,
}: {
  date: LocalDate;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
}) {
  const day = Number(date.slice(8, 10));
  return (
    <span className="flex items-center gap-1.5" aria-hidden="true">
      <span
        className={cn(
          "inline-flex size-6 items-center justify-center rounded-full text-[13px] tabular-nums",
          isToday
            ? "bg-accent font-semibold text-accent-fg"
            : cn(inMonth ? "text-fg" : "text-fg-subtle", isSelected && "font-semibold text-accent-text"),
        )}
      >
        {day}
      </span>
      {isToday ? (
        <span className="hidden text-[11px] font-medium text-accent-text @[6.5rem]:inline">Today</span>
      ) : null}
    </span>
  );
}

function CellContent({ summary, categories }: { summary: DaySummary; categories: Map<string, ActivityCategory> }) {
  const currencies = currenciesIn(summary.cashFlow);
  const hasActivities = summary.segments.length > 0;
  const income = currencies.filter((currency) => (summary.cashFlow[currency]?.income ?? 0) > 0);
  const expense = currencies.filter((currency) => (summary.cashFlow[currency]?.expense ?? 0) > 0);
  const hidden = summary.segments.length - MAX_LINES;

  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5" aria-hidden="true">
      {/* Narrow cells (phones): category dots, hours and money direction. */}
      <span className="flex flex-col gap-1 @[5.5rem]:hidden">
        {hasActivities ? (
          <span className="flex flex-wrap items-center gap-0.5 px-0.5">
            {summary.segments.slice(0, MAX_DOTS).map((segment) => (
              <span
                key={`${segment.activity.id}:${segment.date}`}
                className={cn(
                  "size-1.5 rounded-full",
                  segment.activity.status === "scheduled" && "bg-transparent ring-1 ring-current ring-inset",
                )}
                style={
                  segment.activity.status === "scheduled"
                    ? { color: categories.get(segment.activity.categoryId)?.color ?? FALLBACK_COLOR }
                    : { backgroundColor: categories.get(segment.activity.categoryId)?.color ?? FALLBACK_COLOR }
                }
              />
            ))}
          </span>
        ) : null}
        <span className="flex flex-wrap items-center gap-x-1 px-0.5 text-[10px] leading-3 tabular-nums">
          {hasActivities ? (
            <span className="text-fg-muted">{Math.round(summary.activityMinutes / 60) || "<1"}h</span>
          ) : null}
          {income.length > 0 ? <ArrowUpRight className="size-3 text-income" /> : null}
          {expense.length > 0 ? <ArrowDownRight className="size-3 text-expense" /> : null}
        </span>
      </span>

      {/* Wider cells: activity titles, then the day's totals. */}
      <span className="hidden min-w-0 flex-1 flex-col gap-px @[5.5rem]:flex">
        {summary.segments.slice(0, MAX_LINES).map((segment) => {
          const color = categories.get(segment.activity.categoryId)?.color ?? FALLBACK_COLOR;
          const scheduled = segment.activity.status === "scheduled";
          return (
            <span
              key={`${segment.activity.id}:${segment.date}`}
              className="flex min-w-0 items-center gap-1.5 rounded px-1 text-[11px] leading-[1.125rem]"
            >
              <span
                className={cn("size-1.5 shrink-0 rounded-full", scheduled && "ring-1 ring-current ring-inset")}
                style={scheduled ? { color } : { backgroundColor: color }}
              />
              <span className={cn("truncate", scheduled ? "text-fg-muted" : "text-fg")}>{segment.activity.title}</span>
            </span>
          );
        })}
        {hidden > 0 ? <span className="px-1 text-[11px] leading-4 text-fg-subtle">+{hidden} more</span> : null}
        <span className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-0 px-1 pt-1 text-[11px] font-medium leading-4 tabular-nums">
          {hasActivities ? <span className="text-fg-muted">{formatDuration(summary.activityMinutes)}</span> : null}
          {income.map((currency) => (
            <span key={`in-${currency}`} className="text-income">
              +{compactMoney(summary.cashFlow[currency]?.income ?? 0, currency)}
            </span>
          ))}
          {expense.map((currency) => (
            <span key={`out-${currency}`} className="text-expense">
              {"−"}
              {compactMoney(summary.cashFlow[currency]?.expense ?? 0, currency)}
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}
