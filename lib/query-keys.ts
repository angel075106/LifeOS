/**
 * TanStack Query keys. The first element names the database table, so a change to a table
 * (from a mutation or a Realtime notification) invalidates every query built on it.
 */
export const queryKeys = {
  profile: ["profiles"] as const,
  activityCategories: ["activity_categories"] as const,
  financeCategories: ["finance_categories"] as const,
  activitiesRange: (startMs: number, endMs: number) => ["activities", "range", startMs, endMs] as const,
  transactionsRange: (from: string, to: string) => ["transactions", "range", from, to] as const,
  recentTransactions: (limit: number) => ["transactions", "recent", limit] as const,
  budgets: (fromMonth: string, toMonth: string) => ["budgets", fromMonth, toMonth] as const,
};

export const SYNCED_TABLES = [
  "profiles",
  "activity_categories",
  "activities",
  "finance_categories",
  "transactions",
  "budgets",
] as const;

export type SyncedTable = (typeof SYNCED_TABLES)[number];

export function isSyncedTable(value: unknown): value is SyncedTable {
  return typeof value === "string" && (SYNCED_TABLES as readonly string[]).includes(value);
}
