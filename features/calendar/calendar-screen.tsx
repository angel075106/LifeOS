"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Columns3, Square } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/feedback";
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
import { UpcomingPanel } from "./upcoming-panel";
import { useCalendarState } from "./use-calendar-state";

const LAYOUT = "grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(21rem,24rem)]";

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
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
          <h1
            id="calendar-title"
            className="truncate text-xl font-semibold tracking-tight text-fg md:text-2xl"
            aria-live="polite"
          >
            {title}
          </h1>
          <p className="mt-0.5 text-sm text-fg-muted">
            Today is {formatLocalDate(today, { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto">
          <div className="flex items-center rounded-lg border border-border-strong bg-surface shadow-card">
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-r-none"
              onClick={() => step(-1)}
              aria-label={`Previous ${stepLabel}`}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <span className="h-5 w-px bg-border" aria-hidden="true" />
            <Button
              variant="ghost"
              size="sm"
              className="rounded-none px-3 text-fg"
              onClick={() => navigate({ date: today })}
              disabled={date === today}
            >
              Today
            </Button>
            <span className="h-5 w-px bg-border" aria-hidden="true" />
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-l-none"
              onClick={() => step(1)}
              aria-label={`Next ${stepLabel}`}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
          <SegmentedControl<CalendarView>
            label="Calendar view"
            size="sm"
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
      </div>

      <div className={LAYOUT}>
        <section
          aria-labelledby="calendar-title"
          className="min-w-0 self-start overflow-hidden rounded-xl border border-border bg-surface shadow-card"
        >
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
        </section>

        <div className="grid min-w-0 content-start gap-5">
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
          <UpcomingPanel
            today={today}
            now={now}
            timeZone={timezone}
            categories={activityCategories}
            onSelectDay={(day) => navigate({ date: day })}
            onOpenActivity={(activity) => openActivity({ mode: "edit", activity })}
            onPlan={() => openActivity({ mode: "create", date: today })}
          />
        </div>
      </div>
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true">
      <div className="flex items-center gap-3">
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-7 w-48 rounded-lg" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-8 w-56 rounded-lg" />
      </div>
      <div className={LAYOUT}>
        <Skeleton className="h-[70dvh] rounded-xl" />
        <Skeleton className="h-[50dvh] rounded-xl" />
      </div>
    </div>
  );
}
