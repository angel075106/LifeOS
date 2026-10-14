"use client";

import { ArrowDownRight, ArrowUpRight, CalendarClock, Clock } from "lucide-react";
import { useEffect, useEffectEvent, useMemo, useRef } from "react";
import { currenciesIn } from "@/features/finance/calc";
import {
  formatClockTime,
  formatDuration,
  formatLocalDate,
  minutesOfDayInZone,
  MINUTES_PER_DAY,
  type LocalDate,
} from "@/lib/dates";
import type { Activity, ActivityCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { DaySummary } from "./day-index";
import { compactMoney, describeDay } from "./day-labels";
import { layoutDaySegments, MIN_VISUAL_MINUTES } from "./time-grid-layout";

const HOUR_PX = 44;
const GRID_HEIGHT = HOUR_PX * 24;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

type TimeGridViewProps = {
  days: LocalDate[];
  selected: LocalDate;
  today: LocalDate;
  now: number;
  timeZone: string;
  index: Map<LocalDate, DaySummary>;
  categories: Map<string, ActivityCategory>;
  loading: boolean;
  onSelectDay: (date: LocalDate) => void;
  onOpenActivity: (activity: Activity) => void;
  onCreateAt: (date: LocalDate, minute: number) => void;
};

export function TimeGridView({
  days,
  selected,
  today,
  now,
  timeZone,
  index,
  categories,
  loading,
  onSelectDay,
  onOpenActivity,
  onCreateAt,
}: TimeGridViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const columns = `3rem repeat(${days.length}, minmax(0, 1fr))`;

  // When the visible period changes: show the current time if today is visible, else 07:00.
  const periodKey = days.join(",");
  const scrollToStart = useEffectEvent(() => {
    const minute = days.includes(today) ? Math.max(0, minutesOfDayInZone(now, timeZone) - 120) : 7 * 60;
    scrollRef.current?.scrollTo({ top: Math.max(0, (minute / 60) * HOUR_PX - 12) });
  });
  // Only when the period changes, not on every data refresh or clock tick.
  useEffect(() => {
    scrollToStart();
  }, [periodKey]);

  return (
    <div className={cn("transition-opacity", loading && "opacity-60")} aria-busy={loading}>
      {/* Day headers with totals */}
      <div className="grid border-b border-border" style={{ gridTemplateColumns: columns }}>
        <div aria-hidden="true" />
        {days.map((day) => {
          const summary = index.get(day);
          const isToday = day === today;
          const isSelected = day === selected;
          const currencies = summary ? currenciesIn(summary.cashFlow) : [];
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDay(day)}
              aria-label={describeDay(day, summary, { today: isToday, selected: isSelected })}
              aria-pressed={isSelected}
              className={cn(
                "@container flex min-w-0 flex-col items-center gap-0.5 border-l border-border px-0.5 py-2 transition-colors hover:bg-muted/70 focus-visible:-outline-offset-2",
                isSelected && "bg-accent-soft/60 shadow-[inset_0_-2px_0_var(--accent)] hover:bg-accent-soft",
              )}
            >
              <span className="text-[11px] font-medium text-fg-muted" aria-hidden="true">
                {formatLocalDate(day, { weekday: "short" })}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex size-7 items-center justify-center rounded-full text-sm tabular-nums",
                  isToday ? "bg-accent font-semibold text-accent-fg" : isSelected ? "font-semibold text-accent-text" : "text-fg",
                )}
              >
                {Number(day.slice(8, 10))}
              </span>
              <span className="hidden flex-col items-center gap-0.5 text-[10px] font-medium leading-4 tabular-nums @[5.5rem]:flex" aria-hidden="true">
                {summary && summary.activityMinutes > 0 ? (
                  <span className="inline-flex items-center gap-0.5 text-fg-muted">
                    <Clock className="size-3 text-fg-subtle" />
                    {formatDuration(summary.activityMinutes)}
                  </span>
                ) : null}
                {currencies.map((currency) => {
                  const totals = summary?.cashFlow[currency];
                  if (!totals) return null;
                  return (
                    <span key={currency} className="inline-flex flex-wrap justify-center gap-x-1">
                      {totals.income > 0 ? (
                        <span className="inline-flex items-center text-income">
                          <ArrowUpRight className="size-3" />+{compactMoney(totals.income, currency)}
                        </span>
                      ) : null}
                      {totals.expense > 0 ? (
                        <span className="inline-flex items-center text-expense">
                          <ArrowDownRight className="size-3" />
                          {"−"}
                          {compactMoney(totals.expense, currency)}
                        </span>
                      ) : null}
                    </span>
                  );
                })}
              </span>
              {/* Narrow columns: glyphs only */}
              <span className="flex items-center gap-0.5 @[5.5rem]:hidden" aria-hidden="true">
                {summary && summary.activityMinutes > 0 ? <Clock className="size-2.5 text-fg-subtle" /> : null}
                {currencies.some((c) => (summary?.cashFlow[c]?.income ?? 0) > 0) ? (
                  <ArrowUpRight className="size-3 text-income" />
                ) : null}
                {currencies.some((c) => (summary?.cashFlow[c]?.expense ?? 0) > 0) ? (
                  <ArrowDownRight className="size-3 text-expense" />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      {/* Scrollable 24h grid */}
      <div ref={scrollRef} className="max-h-[62dvh] overflow-y-auto overscroll-contain" tabIndex={-1}>
        <div className="relative grid" style={{ gridTemplateColumns: columns, height: GRID_HEIGHT }}>
          <div className="relative" aria-hidden="true">
            {HOURS.map((hour) => (
              <span
                key={hour}
                className="absolute right-1.5 -translate-y-1/2 text-[10px] tabular-nums text-fg-subtle"
                style={{ top: hour * HOUR_PX }}
              >
                {hour === 0 ? "" : `${String(hour).padStart(2, "0")}:00`}
              </span>
            ))}
          </div>
          {days.map((day) => (
            <DayColumn
              key={day}
              day={day}
              summary={index.get(day)}
              categories={categories}
              timeZone={timeZone}
              nowMinute={day === today ? minutesOfDayInZone(now, timeZone) : null}
              onOpenActivity={onOpenActivity}
              onCreateAt={onCreateAt}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DayColumn({
  day,
  summary,
  categories,
  timeZone,
  nowMinute,
  onOpenActivity,
  onCreateAt,
}: {
  day: LocalDate;
  summary: DaySummary | undefined;
  categories: Map<string, ActivityCategory>;
  timeZone: string;
  nowMinute: number | null;
  onOpenActivity: (activity: Activity) => void;
  onCreateAt: (date: LocalDate, minute: number) => void;
}) {
  const positioned = useMemo(() => layoutDaySegments(summary?.segments ?? []), [summary]);

  return (
    <div
      className="relative border-l border-border"
      style={{
        backgroundImage: `repeating-linear-gradient(to bottom, var(--border) 0, var(--border) 1px, transparent 1px, transparent ${HOUR_PX}px)`,
      }}
      onClick={(event) => {
        // Clicking empty space starts a new activity at that time (keyboard users can use
        // the "Activity" quick-add buttons instead).
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const minute = Math.floor(((event.clientY - rect.top) / rect.height) * MINUTES_PER_DAY / 15) * 15;
        onCreateAt(day, Math.max(0, Math.min(minute, MINUTES_PER_DAY - 15)));
      }}
    >
      {positioned.map((segment) => {
        const category = categories.get(segment.activity.categoryId);
        const color = category?.color ?? "#94a3b8";
        const height = Math.max(segment.endMinute - segment.startMinute, MIN_VISUAL_MINUTES);
        const scheduled = segment.activity.status === "scheduled";
        const timeRange = `${formatClockTime(segment.activity.startMs, timeZone)}–${formatClockTime(segment.activity.endMs, timeZone)}`;
        return (
          <button
            key={`${segment.activity.id}:${segment.date}`}
            type="button"
            onClick={() => onOpenActivity(segment.activity)}
            aria-label={`${segment.activity.title}, ${timeRange}, ${category?.name ?? "uncategorized"}${scheduled ? ", scheduled" : ", completed"}. Edit`}
            className={cn(
              "@container absolute overflow-hidden rounded-md border border-l-[3px] px-1.5 py-0.5 text-left text-[11px] leading-tight text-fg transition-[filter] hover:brightness-95 focus-visible:z-10 dark:hover:brightness-125",
              scheduled ? "border-dashed" : "border-solid",
              segment.continuesBefore && "rounded-t-none",
              segment.continuesAfter && "rounded-b-none",
            )}
            style={{
              top: `${(segment.startMinute / MINUTES_PER_DAY) * 100}%`,
              height: `calc(${(height / MINUTES_PER_DAY) * 100}% - 1px)`,
              left: `calc(${(segment.column / segment.columns) * 100}% + 1px)`,
              width: `calc(${100 / segment.columns}% - 2px)`,
              borderColor: `color-mix(in srgb, ${color} 55%, transparent)`,
              borderLeftColor: color,
              backgroundColor: `color-mix(in srgb, ${color} ${scheduled ? 8 : 18}%, var(--surface))`,
            }}
          >
            <span className="flex items-center gap-1 font-medium">
              {scheduled ? <CalendarClock className="size-3 shrink-0 text-accent-text" aria-hidden="true" /> : null}
              <span className="truncate">{segment.activity.title}</span>
            </span>
            {/* Secondary lines only when the block is wide enough to show them legibly. */}
            {height >= 40 ? (
              <span className="hidden truncate text-[10px] tabular-nums text-fg-muted @[4.5rem]:block">{timeRange}</span>
            ) : null}
            {height >= 70 && category ? (
              <span className="hidden truncate text-[10px] text-fg-muted @[4.5rem]:block">{category.name}</span>
            ) : null}
          </button>
        );
      })}
      {nowMinute !== null ? (
        <div
          className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
          style={{ top: `${(nowMinute / MINUTES_PER_DAY) * 100}%` }}
          aria-hidden="true"
        >
          <span className="-ml-1 size-2 rounded-full bg-expense" />
          <span className="h-px flex-1 bg-expense/80" />
        </div>
      ) : null}
    </div>
  );
}
