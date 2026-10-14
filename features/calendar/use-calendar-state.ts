"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useProfile } from "@/features/app/session";
import {
  addDays,
  addMonths,
  isValidLocalDate,
  monthGridWeeks,
  todayInZone,
  weekDays,
  type LocalDate,
} from "@/lib/dates";
import { CALENDAR_VIEWS, type CalendarView } from "@/lib/types";

function isCalendarView(value: unknown): value is CalendarView {
  return typeof value === "string" && (CALENDAR_VIEWS as readonly string[]).includes(value);
}

/** Current time, refreshed every `intervalMs` so "today" and the now-line stay correct. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") setNow(Date.now());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);
  return now;
}

/**
 * Calendar view and selected date, stored in the URL (?view=&date=) so a reload or a
 * shared link restores the same position. Updates use history.replaceState, which Next.js
 * syncs with useSearchParams without a server round trip.
 */
export function useCalendarState() {
  const profile = useProfile();
  const searchParams = useSearchParams();
  const now = useNow();
  const today = todayInZone(profile.timezone, now);

  const viewParam = searchParams.get("view");
  const dateParam = searchParams.get("date");
  const view: CalendarView = isCalendarView(viewParam) ? viewParam : profile.defaultCalendarView;
  const date: LocalDate = isValidLocalDate(dateParam) ? dateParam : today;

  const navigate = useCallback(
    (next: { view?: CalendarView; date?: LocalDate }) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", next.view ?? view);
      params.set("date", next.date ?? date);
      window.history.replaceState(null, "", `?${params.toString()}`);
    },
    [searchParams, view, date],
  );

  const step = useCallback(
    (direction: 1 | -1) => {
      const nextDate =
        view === "month" ? addMonths(date, direction) : view === "week" ? addDays(date, 7 * direction) : addDays(date, direction);
      navigate({ date: nextDate });
    },
    [view, date, navigate],
  );

  const weeks = useMemo(() => monthGridWeeks(date, profile.weekStartsOn), [date, profile.weekStartsOn]);
  const days = useMemo(() => {
    if (view === "month") return weeks.flat();
    if (view === "week") return weekDays(date, profile.weekStartsOn);
    return [date];
  }, [view, date, weeks, profile.weekStartsOn]);

  // Data is loaded for the whole month grid around the date. The week and day views always
  // fall inside it, so switching views within the same period needs no new request.
  const rangeDays = useMemo(() => weeks.flat(), [weeks]);

  return { view, date, today, now, weeks, days, rangeDays, navigate, step, timezone: profile.timezone };
}
