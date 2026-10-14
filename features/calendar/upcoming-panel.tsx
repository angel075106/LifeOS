"use client";

import { CalendarClock, CalendarPlus, CalendarSearch } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/panel";
import { useActivitiesForDays } from "@/features/data/hooks";
import {
  addDays,
  diffInDays,
  formatClockTime,
  formatLocalDate,
  localDateOfInstant,
  type LocalDate,
} from "@/lib/dates";
import { toAppError } from "@/lib/errors";
import type { Activity, ActivityCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const DAYS_AHEAD = 7;
const MAX_ITEMS = 6;

type UpcomingPanelProps = {
  today: LocalDate;
  now: number;
  timeZone: string;
  categories: Map<string, ActivityCategory>;
  onSelectDay: (date: LocalDate) => void;
  onOpenActivity: (activity: Activity) => void;
  onPlan: () => void;
};

function dayLabel(date: LocalDate, today: LocalDate): string {
  const offset = diffInDays(date, today);
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  return formatLocalDate(date, { weekday: "short", day: "numeric", month: "short" });
}

/** What is happening now and next: activities that have not ended yet, over the next week. */
export function UpcomingPanel({ today, now, timeZone, categories, onSelectDay, onOpenActivity, onPlan }: UpcomingPanelProps) {
  const query = useActivitiesForDays(today, addDays(today, DAYS_AHEAD - 1));

  const upcoming = useMemo(
    () =>
      (query.data ?? [])
        .filter((activity) => activity.endMs > now)
        .sort((a, b) => a.startMs - b.startMs)
        .slice(0, MAX_ITEMS),
    [query.data, now],
  );

  return (
    <Panel title="Upcoming" description={`Next ${DAYS_AHEAD} days`} padding="sm" aria-label="Upcoming activities">
      {query.isPending ? (
        <div className="grid gap-2 p-1" aria-hidden="true">
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
        </div>
      ) : query.error ? (
        <ErrorState message={toAppError(query.error).message} onRetry={() => void query.refetch()} />
      ) : upcoming.length === 0 ? (
        <div className="flex flex-col items-start gap-3 px-1 py-2">
          <p className="text-sm text-fg-muted">Nothing planned for the next {DAYS_AHEAD} days.</p>
          <Button variant="secondary" size="sm" onClick={onPlan}>
            <CalendarPlus aria-hidden="true" />
            Plan an activity
          </Button>
        </div>
      ) : (
        <ol className="grid gap-0.5">
          {upcoming.map((activity) => {
            const day = localDateOfInstant(activity.startMs, timeZone);
            const inProgress = activity.startMs <= now;
            const scheduled = activity.status === "scheduled";
            const category = categories.get(activity.categoryId);
            const start = formatClockTime(activity.startMs, timeZone);
            const end = formatClockTime(activity.endMs, timeZone);
            const when = inProgress ? `Now, until ${end}` : `${dayLabel(day, today)}, ${start}–${end}`;
            return (
              <li key={activity.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onOpenActivity(activity)}
                  aria-label={`Edit ${activity.title}, ${when}${scheduled ? ", scheduled" : ""}`}
                  className="grid min-w-0 flex-1 grid-cols-[3px_minmax(0,1fr)] gap-x-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted focus-visible:-outline-offset-2"
                >
                  <span
                    className={cn("rounded-full", scheduled && "opacity-50")}
                    style={{ backgroundColor: category?.color ?? "var(--fg-subtle)" }}
                    aria-hidden="true"
                  />
                  <span className="grid min-w-0 gap-0.5" aria-hidden="true">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-medium text-fg">{activity.title}</span>
                      {scheduled ? (
                        <Badge variant="scheduled" className="shrink-0">
                          <CalendarClock aria-hidden="true" />
                          Scheduled
                        </Badge>
                      ) : null}
                    </span>
                    <span className={cn("text-xs tabular-nums", inProgress ? "font-medium text-accent-text" : "text-fg-muted")}>
                      {when}
                      {category ? <span className="text-fg-subtle"> · {category.name}</span> : null}
                    </span>
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-fg-subtle"
                  onClick={() => onSelectDay(day)}
                  aria-label={`Show ${formatLocalDate(day, { weekday: "long", day: "numeric", month: "long" })} in the calendar`}
                  title="Show in calendar"
                >
                  <CalendarSearch aria-hidden="true" />
                </Button>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
