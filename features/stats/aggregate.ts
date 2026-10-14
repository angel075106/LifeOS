import type { DaySummary } from "@/features/calendar/day-index";
import { bucketRanges, type Granularity } from "@/features/finance/calc";
import { diffInDays, type LocalDate, type WeekStart } from "@/lib/dates";

/** Daily bars up to a month, weekly up to ~4 months, monthly beyond. */
export function chooseGranularity(from: LocalDate, to: LocalDate): Granularity {
  const days = diffInDays(to, from) + 1;
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  return "month";
}

export type ActivityTotals = {
  /** Tracked minutes inside the range (activities crossing the range edge are clipped). */
  minutes: number;
  /** Distinct activities touching the range. */
  activities: number;
  /** Days with at least one tracked minute. */
  activeDays: number;
};

export function activityTotals(days: Iterable<DaySummary>, categoryId: string | null = null): ActivityTotals {
  let minutes = 0;
  let activeDays = 0;
  const ids = new Set<string>();
  for (const day of days) {
    let dayMinutes = 0;
    for (const segment of day.segments) {
      if (categoryId && segment.activity.categoryId !== categoryId) continue;
      dayMinutes += (segment.endMs - segment.startMs) / 60_000;
      ids.add(segment.activity.id);
    }
    if (dayMinutes > 0) activeDays += 1;
    minutes += dayMinutes;
  }
  return { minutes, activities: ids.size, activeDays };
}

export function minutesByCategory(days: Iterable<DaySummary>): Array<{ categoryId: string; minutes: number; share: number }> {
  const totals = new Map<string, number>();
  for (const day of days) {
    for (const segment of day.segments) {
      const id = segment.activity.categoryId;
      totals.set(id, (totals.get(id) ?? 0) + (segment.endMs - segment.startMs) / 60_000);
    }
  }
  const grand = Array.from(totals.values()).reduce((sum, value) => sum + value, 0);
  return Array.from(totals, ([categoryId, minutes]) => ({ categoryId, minutes, share: grand === 0 ? 0 : minutes / grand }))
    .sort((a, b) => b.minutes - a.minutes || a.categoryId.localeCompare(b.categoryId));
}

export type MinutesBucket = { key: string; label: string; minutes: number };

/** Tracked minutes per day/week/month bucket covering `from`..`to`. */
export function minutesByBucket(
  index: Map<LocalDate, DaySummary>,
  from: LocalDate,
  to: LocalDate,
  granularity: Granularity,
  weekStartsOn: WeekStart,
  categoryId: string | null = null,
): MinutesBucket[] {
  return bucketRanges(from, to, granularity, weekStartsOn).map((bucket) => {
    let minutes = 0;
    for (const [date, day] of index) {
      if (date < bucket.start || date > bucket.end || date < from || date > to) continue;
      for (const segment of day.segments) {
        if (categoryId && segment.activity.categoryId !== categoryId) continue;
        minutes += (segment.endMs - segment.startMs) / 60_000;
      }
    }
    return { key: bucket.key, label: bucket.label, minutes };
  });
}
