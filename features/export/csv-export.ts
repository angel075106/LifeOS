import { csvNumber, toCsv } from "@/lib/csv";
import { formatClockTime, localDateOfInstant } from "@/lib/dates";
import { minorToDecimalString } from "@/lib/money";
import type { Activity, ActivityCategory, FinanceCategory, Transaction } from "@/lib/types";

export const TRANSACTION_COLUMNS = [
  "date",
  "type",
  "amount",
  "currency",
  "category",
  "description",
  "id",
  "created_at",
  "updated_at",
] as const;

export const ACTIVITY_COLUMNS = [
  "date",
  "start_local",
  "end_local",
  "time_zone",
  "duration_minutes",
  "title",
  "category",
  "status",
  "notes",
  "start_utc",
  "end_utc",
  "id",
  "created_at",
  "updated_at",
] as const;

/** Transactions as CSV. Amounts are positive decimals; the type column carries the direction. */
export function transactionsCsv(
  transactions: readonly Transaction[],
  categories: ReadonlyMap<string, FinanceCategory>,
): string {
  const rows = [...transactions]
    .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.createdAt.localeCompare(b.createdAt))
    .map((transaction) => [
      transaction.occurredOn,
      transaction.type,
      csvNumber(minorToDecimalString(transaction.amountMinor, transaction.currency)),
      transaction.currency,
      categories.get(transaction.categoryId)?.name ?? "",
      transaction.description,
      transaction.id,
      transaction.createdAt,
      transaction.updatedAt,
    ]);
  return toCsv(TRANSACTION_COLUMNS, rows);
}

/** Activities as CSV with local times in `timeZone` plus exact UTC timestamps. */
export function activitiesCsv(
  activities: readonly Activity[],
  categories: ReadonlyMap<string, ActivityCategory>,
  timeZone: string,
): string {
  const rows = [...activities]
    .sort((a, b) => a.startMs - b.startMs)
    .map((activity) => {
      const startDate = localDateOfInstant(activity.startMs, timeZone);
      const endDate = localDateOfInstant(activity.endMs, timeZone);
      return [
        startDate,
        `${startDate} ${formatClockTime(activity.startMs, timeZone)}`,
        `${endDate} ${formatClockTime(activity.endMs, timeZone)}`,
        timeZone,
        csvNumber(String(Math.round((activity.endMs - activity.startMs) / 60_000))),
        activity.title,
        categories.get(activity.categoryId)?.name ?? "",
        activity.status,
        activity.notes,
        new Date(activity.startMs).toISOString(),
        new Date(activity.endMs).toISOString(),
        activity.id,
        activity.createdAt,
        activity.updatedAt,
      ];
    });
  return toCsv(ACTIVITY_COLUMNS, rows);
}
