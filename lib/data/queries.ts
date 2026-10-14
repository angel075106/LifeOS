import type { PostgrestError } from "@supabase/supabase-js";
import { MS_PER_DAY, type LocalDate } from "@/lib/dates";
import type { Tables } from "@/lib/supabase/database.types";
import type { TypedSupabaseClient } from "@/lib/supabase/typed-client";
import {
  mapActivity,
  mapActivityCategory,
  mapBudget,
  mapFinanceCategory,
  mapProfile,
  mapTransaction,
} from "./mappers";

/**
 * Read queries shared by the browser (TanStack Query) and the server (CSV export).
 * Every query runs with the caller's session, so RLS limits results to their own rows;
 * no query filters by user_id for security.
 */

/** Activities are at most 24h long (DB constraint), which bounds range scans. */
const MAX_ACTIVITY_MS = MS_PER_DAY;
const PAGE_SIZE = 1000;
/** Safety cap for range fetches (statistics/export). */
export const MAX_RANGE_ROWS = 25_000;

export class RangeTooLargeError extends Error {
  constructor() {
    super("Too many records in the selected range. Choose a shorter period.");
    this.name = "RangeTooLargeError";
  }
}

type PageResult<Row> = { data: Row[] | null; error: PostgrestError | null; count: number | null };

/**
 * Fetches every row of a range query. The first request asks for an exact count, so a
 * project-level max_rows lower than PAGE_SIZE cannot silently truncate results.
 */
async function fetchAllRows<Row>(
  request: (from: number, to: number, withCount: boolean) => PromiseLike<PageResult<Row>>,
): Promise<Row[]> {
  const first = await request(0, PAGE_SIZE - 1, true);
  if (first.error) throw first.error;
  const rows = [...(first.data ?? [])];
  const total = first.count ?? rows.length;
  if (total > MAX_RANGE_ROWS) throw new RangeTooLargeError();

  while (rows.length < total) {
    const page = await request(rows.length, rows.length + PAGE_SIZE - 1, false);
    if (page.error) throw page.error;
    if (!page.data || page.data.length === 0) break;
    rows.push(...page.data);
  }
  return rows;
}

const iso = (ms: number) => new Date(ms).toISOString();

export async function fetchProfile(supabase: TypedSupabaseClient, userId: string) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data ? mapProfile(data) : null;
}

export async function fetchActivityCategories(supabase: TypedSupabaseClient) {
  const { data, error } = await supabase
    .from("activity_categories")
    .select("*")
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []).map(mapActivityCategory);
}

export async function fetchFinanceCategories(supabase: TypedSupabaseClient) {
  const { data, error } = await supabase
    .from("finance_categories")
    .select("*")
    .order("kind")
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []).map(mapFinanceCategory);
}

/** Activities overlapping the half-open instant range [startMs, endMs). */
export async function fetchActivitiesOverlapping(supabase: TypedSupabaseClient, startMs: number, endMs: number) {
  const rows = await fetchAllRows<Tables<"activities">>((from, to, withCount) =>
    supabase
      .from("activities")
      .select("*", withCount ? { count: "exact" } : undefined)
      .lt("start_at", iso(endMs))
      .gt("end_at", iso(startMs))
      .gte("start_at", iso(startMs - MAX_ACTIVITY_MS))
      .order("start_at")
      .order("id")
      .range(from, to),
  );
  return rows.map(mapActivity);
}

/** Transactions dated between `from` and `to`, inclusive. */
export async function fetchTransactionsBetween(supabase: TypedSupabaseClient, from: LocalDate, to: LocalDate) {
  const rows = await fetchAllRows<Tables<"transactions">>((start, end, withCount) =>
    supabase
      .from("transactions")
      .select("*", withCount ? { count: "exact" } : undefined)
      .gte("occurred_on", from)
      .lte("occurred_on", to)
      .order("occurred_on")
      .order("created_at")
      .order("id")
      .range(start, end),
  );
  return rows.map(mapTransaction);
}

/** Budgets for months `fromMonth`..`toMonth` inclusive (both "YYYY-MM-01"). */
export async function fetchBudgets(supabase: TypedSupabaseClient, fromMonth: LocalDate, toMonth: LocalDate) {
  const { data, error } = await supabase
    .from("budgets")
    .select("*")
    .gte("month", fromMonth)
    .lte("month", toMonth)
    .order("month")
    .order("category_id");
  if (error) throw error;
  return (data ?? []).map(mapBudget);
}

/** Activities (other than `excludeId`) that overlap [startMs, endMs). */
export async function findOverlappingActivities(
  supabase: TypedSupabaseClient,
  startMs: number,
  endMs: number,
  excludeId?: string,
) {
  let query = supabase
    .from("activities")
    .select("*")
    .lt("start_at", iso(endMs))
    .gt("end_at", iso(startMs))
    .gte("start_at", iso(startMs - MAX_ACTIVITY_MS))
    .order("start_at")
    .limit(20);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapActivity);
}

/** Most recent transactions overall (by date, then entry time). */
export async function fetchRecentTransactions(supabase: TypedSupabaseClient, limit = 8) {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapTransaction);
}
