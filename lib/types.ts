import type { LocalDate, WeekStart } from "./dates";
import type { Currency } from "./money";

export const ACTIVITY_STATUSES = ["scheduled", "completed"] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export const TRANSACTION_TYPES = ["income", "expense"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const CALENDAR_VIEWS = ["month", "week", "day"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export type Profile = {
  id: string;
  displayName: string | null;
  currency: Currency;
  timezone: string;
  defaultCalendarView: CalendarView;
  weekStartsOn: WeekStart;
  createdAt: string;
  updatedAt: string;
};

export type ActivityCategory = {
  id: string;
  name: string;
  color: string;
  isArchived: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type Activity = {
  id: string;
  categoryId: string;
  title: string;
  notes: string | null;
  /** ISO timestamps exactly as stored (used for optimistic concurrency). */
  startAt: string;
  endAt: string;
  /** Parsed epoch milliseconds for calculations. */
  startMs: number;
  endMs: number;
  status: ActivityStatus;
  createdAt: string;
  updatedAt: string;
};

export type FinanceCategory = {
  id: string;
  kind: TransactionType;
  name: string;
  color: string;
  isArchived: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type Transaction = {
  id: string;
  type: TransactionType;
  amountMinor: number;
  currency: Currency;
  occurredOn: LocalDate;
  categoryId: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Budget = {
  id: string;
  categoryId: string;
  /** First day of the month, "YYYY-MM-01". */
  month: LocalDate;
  currency: Currency;
  amountMinor: number;
  createdAt: string;
  updatedAt: string;
};
