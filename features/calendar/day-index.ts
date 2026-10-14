import { cashFlowByCurrency, type CurrencyTotals } from "@/features/finance/calc";
import {
  addDays,
  dayRangeInstants,
  localDateOfInstant,
  MINUTES_PER_DAY,
  minutesOfDayInZone,
  MS_PER_MINUTE,
  type LocalDate,
} from "@/lib/dates";
import type { Activity, Transaction } from "@/lib/types";

/** The part of an activity that falls on one local calendar day. */
export type ActivitySegment = {
  activity: Activity;
  date: LocalDate;
  /** Clipped to the day, epoch ms. */
  startMs: number;
  endMs: number;
  /** Wall-clock position within the day, 0..1440 (for drawing on a time grid). */
  startMinute: number;
  endMinute: number;
  /** The activity started on an earlier day / continues onto a later day. */
  continuesBefore: boolean;
  continuesAfter: boolean;
};

export type DaySummary = {
  date: LocalDate;
  segments: ActivitySegment[];
  /** Real elapsed minutes of activity within this day (DST-aware, clipped at midnight). */
  activityMinutes: number;
  transactions: Transaction[];
  cashFlow: CurrencyTotals;
};

export function emptyDay(date: LocalDate): DaySummary {
  return { date, segments: [], activityMinutes: 0, transactions: [], cashFlow: {} };
}

/** Splits an activity into per-day segments in `timeZone`. */
export function segmentActivity(activity: Activity, timeZone: string): ActivitySegment[] {
  const segments: ActivitySegment[] = [];
  const firstDay = localDateOfInstant(activity.startMs, timeZone);
  // The last instant inside the activity is endMs - 1 (ranges are half-open).
  const lastDay = localDateOfInstant(activity.endMs - 1, timeZone);

  for (let date = firstDay; date <= lastDay; date = addDays(date, 1)) {
    const day = dayRangeInstants(date, timeZone);
    const startMs = Math.max(activity.startMs, day.start);
    const endMs = Math.min(activity.endMs, day.end);
    if (endMs <= startMs) continue;
    const continuesBefore = activity.startMs < day.start;
    const continuesAfter = activity.endMs > day.end;
    segments.push({
      activity,
      date,
      startMs,
      endMs,
      startMinute: continuesBefore ? 0 : minutesOfDayInZone(startMs, timeZone),
      endMinute: endMs >= day.end ? MINUTES_PER_DAY : minutesOfDayInZone(endMs, timeZone),
      continuesBefore,
      continuesAfter,
    });
  }
  return segments;
}

/**
 * Builds per-day summaries for the given days: activity segments (chronological),
 * tracked time, transactions and per-currency cash flow.
 */
export function buildDayIndex(
  days: readonly LocalDate[],
  activities: readonly Activity[],
  transactions: readonly Transaction[],
  timeZone: string,
): Map<LocalDate, DaySummary> {
  const index = new Map<LocalDate, DaySummary>(days.map((date) => [date, emptyDay(date)]));

  for (const activity of activities) {
    for (const segment of segmentActivity(activity, timeZone)) {
      const day = index.get(segment.date);
      if (!day) continue;
      day.segments.push(segment);
      day.activityMinutes += (segment.endMs - segment.startMs) / MS_PER_MINUTE;
    }
  }

  for (const transaction of transactions) {
    index.get(transaction.occurredOn)?.transactions.push(transaction);
  }

  for (const day of index.values()) {
    day.segments.sort(
      (a, b) => a.startMs - b.startMs || a.endMs - b.endMs || a.activity.title.localeCompare(b.activity.title),
    );
    day.transactions.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    day.cashFlow = cashFlowByCurrency(day.transactions);
  }
  return index;
}
