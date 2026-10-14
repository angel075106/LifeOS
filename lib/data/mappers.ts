import { isValidLocalDate, type WeekStart } from "@/lib/dates";
import { isCurrency, type Currency } from "@/lib/money";
import type { Tables } from "@/lib/supabase/database.types";
import {
  ACTIVITY_STATUSES,
  CALENDAR_VIEWS,
  TRANSACTION_TYPES,
  type Activity,
  type ActivityCategory,
  type ActivityStatus,
  type Budget,
  type CalendarView,
  type FinanceCategory,
  type Profile,
  type Transaction,
  type TransactionType,
} from "@/lib/types";

/**
 * Database rows -> domain objects. The schema's CHECK constraints guarantee these values;
 * the guards here turn any schema drift into a clear error instead of silent bad data.
 */

function oneOf<T extends string>(allowed: readonly T[], value: string, field: string): T {
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new Error(`Unexpected ${field} value from database`);
}

function currency(value: string): Currency {
  if (isCurrency(value)) return value;
  throw new Error("Unexpected currency value from database");
}

function localDate(value: string, field: string) {
  if (isValidLocalDate(value)) return value;
  throw new Error(`Unexpected ${field} value from database`);
}

function amount(value: number | string): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (!Number.isSafeInteger(parsed)) throw new Error("Unexpected amount value from database");
  return parsed;
}

export function mapProfile(row: Tables<"profiles">): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    currency: currency(row.currency),
    timezone: row.timezone,
    defaultCalendarView: oneOf<CalendarView>(CALENDAR_VIEWS, row.default_calendar_view, "calendar view"),
    weekStartsOn: (row.week_starts_on === 0 ? 0 : 1) satisfies WeekStart,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapActivityCategory(row: Tables<"activity_categories">): ActivityCategory {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    isArchived: row.is_archived,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapActivity(row: Tables<"activities">): Activity {
  const startMs = Date.parse(row.start_at);
  const endMs = Date.parse(row.end_at);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    throw new Error("Unexpected activity time from database");
  }
  return {
    id: row.id,
    categoryId: row.category_id,
    title: row.title,
    notes: row.notes,
    startAt: row.start_at,
    endAt: row.end_at,
    startMs,
    endMs,
    status: oneOf<ActivityStatus>(ACTIVITY_STATUSES, row.status, "activity status"),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapFinanceCategory(row: Tables<"finance_categories">): FinanceCategory {
  return {
    id: row.id,
    kind: oneOf<TransactionType>(TRANSACTION_TYPES, row.kind, "category kind"),
    name: row.name,
    color: row.color,
    isArchived: row.is_archived,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTransaction(row: Tables<"transactions">): Transaction {
  return {
    id: row.id,
    type: oneOf<TransactionType>(TRANSACTION_TYPES, row.type, "transaction type"),
    amountMinor: amount(row.amount_minor),
    currency: currency(row.currency),
    occurredOn: localDate(row.occurred_on, "transaction date"),
    categoryId: row.category_id,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapBudget(row: Tables<"budgets">): Budget {
  return {
    id: row.id,
    categoryId: row.category_id,
    month: localDate(row.month, "budget month"),
    currency: currency(row.currency),
    amountMinor: amount(row.amount_minor),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
