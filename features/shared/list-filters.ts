import {
  addDays,
  addMonths,
  endOfMonth,
  localDateOfInstant,
  startOfMonth,
  startOfWeek,
  type LocalDate,
  type WeekStart,
} from "@/lib/dates";
import type { Currency } from "@/lib/money";
import type { Activity, ActivityStatus, Transaction, TransactionType } from "@/lib/types";

export const RANGE_PRESETS = ["this-week", "this-month", "last-30", "last-90", "this-year", "all", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const RANGE_LABELS: Record<RangePreset, string> = {
  "this-week": "This week",
  "this-month": "This month",
  "last-30": "Last 30 days",
  "last-90": "Last 90 days",
  "this-year": "This year",
  all: "All time",
  custom: "Custom range",
};

/** Earliest/latest dates the database accepts; used for "All time". */
export const MIN_DATE: LocalDate = "1970-01-01";
export const MAX_DATE: LocalDate = "2199-12-31";

export function isRangePreset(value: unknown): value is RangePreset {
  return typeof value === "string" && (RANGE_PRESETS as readonly string[]).includes(value);
}

/** Inclusive local-date bounds for a preset. Custom ranges fall back to this month when incomplete. */
export function resolveRange(
  preset: RangePreset,
  today: LocalDate,
  weekStartsOn: WeekStart,
  custom: { from?: LocalDate | null; to?: LocalDate | null } = {},
): { from: LocalDate; to: LocalDate } {
  switch (preset) {
    case "this-week": {
      const from = startOfWeek(today, weekStartsOn);
      return { from, to: addDays(from, 6) };
    }
    case "this-month":
      return { from: startOfMonth(today), to: endOfMonth(today) };
    case "last-30":
      return { from: addDays(today, -29), to: today };
    case "last-90":
      return { from: addDays(today, -89), to: today };
    case "this-year":
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
    case "all":
      return { from: MIN_DATE, to: MAX_DATE };
    case "custom": {
      if (custom.from && custom.to) {
        return custom.from <= custom.to ? { from: custom.from, to: custom.to } : { from: custom.to, to: custom.from };
      }
      return { from: startOfMonth(today), to: endOfMonth(today) };
    }
  }
}

/** Case- and accent-insensitive "contains" match. */
export function matchesText(haystack: Array<string | null | undefined>, query: string): boolean {
  const needle = normalizeText(query);
  if (!needle) return true;
  return haystack.some((value) => value && normalizeText(value).includes(needle));
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase()
    .trim();
}

export type ActivityFilters = {
  query?: string;
  categoryId?: string | null;
  status?: ActivityStatus | null;
};

export function filterActivities(
  activities: readonly Activity[],
  filters: ActivityFilters,
  categoryName: (id: string) => string | undefined = () => undefined,
): Activity[] {
  return activities.filter(
    (activity) =>
      (!filters.categoryId || activity.categoryId === filters.categoryId) &&
      (!filters.status || activity.status === filters.status) &&
      matchesText([activity.title, activity.notes, categoryName(activity.categoryId)], filters.query ?? ""),
  );
}

export type TransactionFilters = {
  query?: string;
  type?: TransactionType | null;
  categoryId?: string | null;
  currency?: Currency | null;
};

export function filterTransactions(
  transactions: readonly Transaction[],
  filters: TransactionFilters,
  categoryName: (id: string) => string | undefined = () => undefined,
): Transaction[] {
  return transactions.filter(
    (transaction) =>
      (!filters.type || transaction.type === filters.type) &&
      (!filters.categoryId || transaction.categoryId === filters.categoryId) &&
      (!filters.currency || transaction.currency === filters.currency) &&
      matchesText([transaction.description, categoryName(transaction.categoryId)], filters.query ?? ""),
  );
}

export type DateGroup<T> = { date: LocalDate; items: T[] };

/**
 * Groups items by local date. Groups are ordered newest- or oldest-first; items inside a
 * day are always chronological.
 */
export function groupByDate<T>(
  items: readonly T[],
  dateOf: (item: T) => LocalDate,
  sortKey: (item: T) => string | number,
  order: "newest" | "oldest",
): DateGroup<T>[] {
  const groups = new Map<LocalDate, T[]>();
  for (const item of items) {
    const date = dateOf(item);
    const list = groups.get(date);
    if (list) list.push(item);
    else groups.set(date, [item]);
  }
  const result = Array.from(groups, ([date, list]) => ({
    date,
    items: [...list].sort((a, b) => {
      const ka = sortKey(a);
      const kb = sortKey(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    }),
  }));
  result.sort((a, b) => (order === "newest" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
  return result;
}

export function activityLocalDate(activity: Activity, timeZone: string): LocalDate {
  return localDateOfInstant(activity.startMs, timeZone);
}

/** Months (first days) covering a range, e.g. for loading budgets. */
export function monthsInRange(from: LocalDate, to: LocalDate): LocalDate[] {
  const months: LocalDate[] = [];
  for (let month = startOfMonth(from); month <= to; month = addMonths(month, 1)) months.push(month);
  return months;
}

/** Whole day groups, in order, until at least `maxItems` items are included. */
export function limitGroups<T>(groups: readonly DateGroup<T>[], maxItems: number): DateGroup<T>[] {
  const result: DateGroup<T>[] = [];
  let count = 0;
  for (const group of groups) {
    if (count >= maxItems) break;
    result.push(group);
    count += group.items.length;
  }
  return result;
}
