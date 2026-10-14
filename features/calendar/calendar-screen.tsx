"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Columns3, Square } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/panel";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useProfile } from "@/features/app/session";
import { useHydrated } from "@/features/app/sync-store";
import {
  useActivitiesForDays,
  useActivityCategoryMap,
  useFinanceCategoryMap,
  useTransactionsForDays,
} from "@/features/data/hooks";
import { useEntryDialogs } from "@/features/entries/entry-dialogs";
import { formatLocalDate, formatLocalDateRange } from "@/lib/dates";
import { toAppError } from "@/lib/errors";
import type { CalendarView } from "@/lib/types";
import { buildDayIndex } from "./day-index";
import { DayDetailPanel } from "./day-detail-panel";
import { MonthView } from "./month-view";
import { TimeGridView } from "./time-grid-view";
import { useCalendarState } from "./use-calendar-state";

export function CalendarScreen() {
  // Dates depend on the device clock and time zone: render after hydration only.
  const hydrated = useHydrated();
  if (!hydrated) return <CalendarSkeleton />;
  return <CalendarContent />;
}

function CalendarContent() {
  const profile = useProfile();
  const calendar = useCalendarState();
  const { view, date, today, now, weeks, days, rangeDays, navigate, step, timezone } = calendar;
  const { openActivity, openTransaction } = useEntryDialogs();

  const from = rangeDays[0];
  const to = rangeDays[rangeDays.length - 1];
  const activitiesQuery = useActivitiesForDays(from, to);
  const transactionsQuery = useTransactionsForDays(from, to);
  const activityCategories = useActivityCategoryMap();
  const financeCategories = useFinanceCategoryMap();

  const index = useMemo(
    () => buildDayIndex(rangeDays, activitiesQuery.data ?? [], transactionsQuery.data ?? [], timezone),
    [rangeDays, activitiesQuery.data, transactionsQuery.data, timezone],
  );

  const loading =
    activitiesQuery.isPending ||
    transactionsQuery.isPending ||
    activitiesQuery.isPlaceholderData ||
    transactionsQuery.isPlaceholderData;
  const queryError = activitiesQuery.error ?? transactionsQuery.error;

  const title =
    view === "month"
      ? formatLocalDate(date, { month: "long", year: "numeric" })
      : view === "week"
        ? formatLocalDateRange(days[0], days[days.length - 1], { day: "numeric", month: "short", year: "numeric" })
        : formatLocalDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const stepLabel = view === "month" ? "month" : view === "week" ? "week" : "day";

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)]">
      <Panel padding="none" className="min-w-0" aria-labelledby="calendar-title">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5 sm:px-4">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => step(-1)} aria-label={`Previous ${stepLabel}`}>
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => step(1)} aria-label={`Next ${stepLabel}`}>
              <ChevronRight aria-hidden="true" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="h-9"
              onClick={() => navigate({ date: today })}
              disabled={date === today}
            >
              Today
            </Button>
          </div>
          <h1 id="calendar-title" className="order-first w-full text-lg font-semibold text-fg sm:order-none sm:w-auto sm:px-2" aria-live="polite">
            {title}
          </h1>
          <SegmentedControl<CalendarView>
            label="Calendar view"
            size="sm"
            className="ml-auto"
            compactOnMobile
            value={view}
            onChange={(next) => navigate({ view: next })}
            options={[
              { value: "month", label: "Month", icon: <CalendarDays aria-hidden="true" /> },
              { value: "week", label: "Week", icon: <Columns3 aria-hidden="true" /> },
              { value: "day", label: "Day", icon: <Square aria-hidden="true" /> },
            ]}
          />
        </div>

        {view === "month" ? (
          <MonthView
            weeks={weeks}
            anchor={date}
            selected={date}
            today={today}
            weekStartsOn={profile.weekStartsOn}
            index={index}
            categories={activityCategories}
            loading={loading}
            onSelect={(next) => navigate({ date: next })}
            labelledBy="calendar-title"
          />
        ) : (
          <TimeGridView
            days={days}
            selected={date}
            today={today}
            now={now}
            timeZone={timezone}
            index={index}
            categories={activityCategories}
            loading={loading}
            onSelectDay={(next) => navigate({ date: next })}
            onOpenActivity={(activity) => openActivity({ mode: "edit", activity })}
            onCreateAt={(day, minute) => {
              navigate({ date: day });
              openActivity({ mode: "create", date: day, startMinute: minute });
            }}
          />
        )}
      </Panel>

      <DayDetailPanel
        date={date}
        today={today}
        summary={index.get(date)}
        timeZone={timezone}
        activityCategories={activityCategories}
        financeCategories={financeCategories}
        loading={loading}
        error={queryError ? toAppError(queryError).message : null}
        onRetry={() => {
          void activitiesQuery.refetch();
          void transactionsQuery.refetch();
        }}
        onAddActivity={() => openActivity({ mode: "create", date })}
        onAddTransaction={(type) => openTransaction({ mode: "create", date, type })}
        onOpenActivity={(activity) => openActivity({ mode: "edit", activity })}
        onOpenTransaction={(transaction) => openTransaction({ mode: "edit", transaction })}
      />
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)]" aria-busy="true">
      <Skeleton className="h-[70dvh]" />
      <Skeleton className="h-[50dvh]" />
    </div>
  );
}
