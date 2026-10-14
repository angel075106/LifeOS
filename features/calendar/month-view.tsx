"use client";

import { ArrowDownRight, ArrowUpRight, Clock } from "lucide-react";
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

const MAX_CHIPS = 3;

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
      <div role="row" className="grid grid-cols-7 border-b border-line">
        {weekdayNames.map((name) => (
          <div
            key={name.long}
            role="columnheader"
            aria-label={name.long}
            className={cn("hud-label py-2 text-center", name.weekend && "text-fg-subtle")}
          >
            {name.short}
          </div>
        ))}
      </div>
      {weeks.map((week) => (
        <div role="row" key={week[0]} className="grid grid-cols-7 border-b border-line last:border-b-0">
          {week.map((date) => {
            const summary = index.get(date);
            const inMonth = isSameMonth(date, anchor);
            const isToday = date === today;
            const isSelected = date === selected;
            return (
              <div role="gridcell" key={date} aria-selected={isSelected} className="@container min-w-0 border-r border-line last:border-r-0">
                <button
                  type="button"
                  data-date={date}
                  tabIndex={isSelected ? 0 : -1}
                  aria-label={describeDay(date, summary, { today: isToday, selected: isSelected })}
                  aria-current={isToday ? "date" : undefined}
                  onClick={() => onSelect(date)}
                  className={cn(
                    "relative flex h-full min-h-16 w-full flex-col gap-1 p-1 text-left transition-colors hover:bg-panel-hover/60 focus-visible:-outline-offset-2 sm:min-h-24 sm:p-1.5 lg:min-h-28",
                    !inMonth && "bg-void/40",
                    isSelected && "bg-cyan/[0.07] shadow-[inset_0_0_0_1px_rgb(34_211_238/0.55)]",
                  )}
                >
                  <DayNumber date={date} inMonth={inMonth} isToday={isToday} />
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

function DayNumber({ date, inMonth, isToday }: { date: LocalDate; inMonth: boolean; isToday: boolean }) {
  const day = Number(date.slice(8, 10));
  return (
    <span className="flex items-center justify-between" aria-hidden="true">
      <span
        className={cn(
          "inline-flex size-6 items-center justify-center rounded-full font-mono text-xs tabular-nums",
          inMonth ? "text-fg" : "text-fg-subtle",
          isToday && "bg-cyan font-semibold text-void",
        )}
      >
        {day}
      </span>
      {isToday ? <span className="hidden font-mono text-[9px] tracking-[0.16em] text-cyan @[6.5rem]:inline">TODAY</span> : null}
    </span>
  );
}

function CellContent({ summary, categories }: { summary: DaySummary; categories: Map<string, ActivityCategory> }) {
  const currencies = currenciesIn(summary.cashFlow);
  const hasActivities = summary.segments.length > 0;
  const income = currencies.filter((currency) => (summary.cashFlow[currency]?.income ?? 0) > 0);
  const expense = currencies.filter((currency) => (summary.cashFlow[currency]?.expense ?? 0) > 0);
  const hidden = summary.segments.length - MAX_CHIPS;

  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5" aria-hidden="true">
      {/* Compact glyphs for narrow cells (phones). */}
      <span className="flex flex-wrap items-center gap-1 @[5.5rem]:hidden">
        {hasActivities ? (
          <span className="inline-flex items-center gap-0.5 font-mono text-[10px] text-cyan-soft">
            <Clock className="size-2.5" />
            {Math.round(summary.activityMinutes / 60) || "<1"}h
          </span>
        ) : null}
        {income.length > 0 ? <ArrowUpRight className="size-3 text-income" /> : null}
        {expense.length > 0 ? <ArrowDownRight className="size-3 text-expense" /> : null}
      </span>

      {/* Detailed content for wider cells. */}
      <span className="hidden min-w-0 flex-col gap-0.5 @[5.5rem]:flex">
        {summary.segments.slice(0, MAX_CHIPS).map((segment) => {
          const category = categories.get(segment.activity.categoryId);
          return (
            <span
              key={`${segment.activity.id}:${segment.date}`}
              className={cn(
                "flex min-w-0 items-center gap-1 rounded-[3px] border-l-2 px-1 py-px text-[11px] leading-4 text-fg",
                segment.activity.status === "scheduled" && "border-dashed opacity-80",
              )}
              style={{
                borderLeftColor: category?.color ?? "var(--color-fg-subtle)",
                backgroundColor: `color-mix(in srgb, ${category?.color ?? "#94a3b8"} 14%, transparent)`,
              }}
            >
              <span className="truncate">{segment.activity.title}</span>
            </span>
          );
        })}
        {hidden > 0 ? <span className="px-1 text-[10px] text-fg-muted">+{hidden} more</span> : null}
        <span className="mt-auto flex flex-col gap-0.5 pt-0.5 font-mono text-[10px] leading-4">
          {hasActivities ? (
            <span className="inline-flex items-center gap-1 text-cyan-soft">
              <Clock className="size-3 shrink-0" />
              {formatDuration(summary.activityMinutes)}
            </span>
          ) : null}
          {income.map((currency) => (
            <span key={`in-${currency}`} className="inline-flex items-center gap-0.5 text-income">
              <ArrowUpRight className="size-3 shrink-0" />+
              {compactMoney(summary.cashFlow[currency]?.income ?? 0, currency)}
            </span>
          ))}
          {expense.map((currency) => (
            <span key={`out-${currency}`} className="inline-flex items-center gap-0.5 text-expense">
              <ArrowDownRight className="size-3 shrink-0" />
              {"−"}
              {compactMoney(summary.cashFlow[currency]?.expense ?? 0, currency)}
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}
