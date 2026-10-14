import {
  addDays,
  addMonths,
  formatLocalDate,
  formatLocalDateRange,
  startOfMonth,
  startOfWeek,
  type LocalDate,
  type WeekStart,
} from "@/lib/dates";
import { CURRENCIES, sumMinor, type Currency } from "@/lib/money";
import type { Budget, Transaction, TransactionType } from "@/lib/types";

/**
 * Finance calculations. All amounts are integer minor units, and every total is kept per
 * currency: EUR and BGN are never added together (no exchange-rate conversion exists).
 * "Net cash flow" is income minus expenses within a period - not an account balance.
 */

export type CashFlow = { income: number; expense: number; net: number; count: number };
export type CurrencyTotals = Partial<Record<Currency, CashFlow>>;

type Money = Pick<Transaction, "type" | "amountMinor" | "currency">;

export function emptyCashFlow(): CashFlow {
  return { income: 0, expense: 0, net: 0, count: 0 };
}

function addTo(totals: CurrencyTotals, transaction: Money): void {
  const current = totals[transaction.currency] ?? emptyCashFlow();
  const income = transaction.type === "income" ? sumMinor([current.income, transaction.amountMinor]) : current.income;
  const expense =
    transaction.type === "expense" ? sumMinor([current.expense, transaction.amountMinor]) : current.expense;
  totals[transaction.currency] = { income, expense, net: income - expense, count: current.count + 1 };
}

export function cashFlowByCurrency(transactions: Iterable<Money>): CurrencyTotals {
  const totals: CurrencyTotals = {};
  for (const transaction of transactions) addTo(totals, transaction);
  return totals;
}

/** Currencies present in `totals`, in the app's canonical order (EUR first). */
export function currenciesIn(totals: CurrencyTotals): Currency[] {
  return CURRENCIES.filter((currency) => totals[currency] !== undefined);
}

export function cashFlowByDate(transactions: Iterable<Money & { occurredOn: LocalDate }>): Map<LocalDate, CurrencyTotals> {
  const byDate = new Map<LocalDate, CurrencyTotals>();
  for (const transaction of transactions) {
    let totals = byDate.get(transaction.occurredOn);
    if (!totals) {
      totals = {};
      byDate.set(transaction.occurredOn, totals);
    }
    addTo(totals, transaction);
  }
  return byDate;
}

export type CategoryTotal = { categoryId: string; totalMinor: number; count: number; share: number };

/** Totals per category for one type and currency, largest first, with each share of the total. */
export function totalsByCategory(
  transactions: Iterable<Pick<Transaction, "type" | "amountMinor" | "currency" | "categoryId">>,
  type: TransactionType,
  currency: Currency,
): CategoryTotal[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const transaction of transactions) {
    if (transaction.type !== type || transaction.currency !== currency) continue;
    const entry = map.get(transaction.categoryId) ?? { total: 0, count: 0 };
    entry.total = sumMinor([entry.total, transaction.amountMinor]);
    entry.count += 1;
    map.set(transaction.categoryId, entry);
  }
  const grandTotal = sumMinor(Array.from(map.values(), (entry) => entry.total));
  return Array.from(map, ([categoryId, entry]) => ({
    categoryId,
    totalMinor: entry.total,
    count: entry.count,
    share: grandTotal === 0 ? 0 : entry.total / grandTotal,
  })).sort((a, b) => b.totalMinor - a.totalMinor || a.categoryId.localeCompare(b.categoryId));
}

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------

export type BudgetStatus = "ok" | "warning" | "over";
/** Spending at or above this share of a budget shows a warning. */
export const BUDGET_WARNING_PERCENT = 80;

export type BudgetUsage = {
  limitMinor: number;
  spentMinor: number;
  remainingMinor: number;
  /** Spent / limit, for display (1 = 100%). */
  ratio: number;
  status: BudgetStatus;
};

export function budgetUsage(limitMinor: number, spentMinor: number): BudgetUsage {
  if (limitMinor <= 0) throw new RangeError("Budget limit must be positive");
  // Integer comparisons: no floating-point rounding decides the status.
  const status: BudgetStatus =
    spentMinor > limitMinor ? "over" : spentMinor * 100 >= limitMinor * BUDGET_WARNING_PERCENT ? "warning" : "ok";
  return {
    limitMinor,
    spentMinor,
    remainingMinor: limitMinor - spentMinor,
    ratio: spentMinor / limitMinor,
    status,
  };
}

export type BudgetLine = { budget: Budget; usage: BudgetUsage };

/**
 * Pairs each budget with the expenses of its category, month and currency.
 * Transactions in other currencies never count against a budget.
 */
export function budgetReport(
  budgets: readonly Budget[],
  transactions: Iterable<Pick<Transaction, "type" | "amountMinor" | "currency" | "categoryId" | "occurredOn">>,
): BudgetLine[] {
  const spent = new Map<string, number>();
  const key = (categoryId: string, month: string, currency: Currency) => `${categoryId}|${month}|${currency}`;
  for (const transaction of transactions) {
    if (transaction.type !== "expense") continue;
    const k = key(transaction.categoryId, startOfMonth(transaction.occurredOn), transaction.currency);
    spent.set(k, sumMinor([spent.get(k) ?? 0, transaction.amountMinor]));
  }
  return budgets.map((budget) => ({
    budget,
    usage: budgetUsage(budget.amountMinor, spent.get(key(budget.categoryId, budget.month, budget.currency)) ?? 0),
  }));
}

// ---------------------------------------------------------------------------
// Time buckets for charts
// ---------------------------------------------------------------------------

export type Granularity = "day" | "week" | "month";

export type CashFlowBucket = {
  key: string;
  label: string;
  start: LocalDate;
  end: LocalDate;
  totals: CurrencyTotals;
};

/** Buckets covering `from`..`to` (inclusive), with every bucket present even when empty. */
export function bucketRanges(
  from: LocalDate,
  to: LocalDate,
  granularity: Granularity,
  weekStartsOn: WeekStart,
): Array<Omit<CashFlowBucket, "totals">> {
  const buckets: Array<Omit<CashFlowBucket, "totals">> = [];
  if (from > to) return buckets;
  let cursor = granularity === "week" ? startOfWeek(from, weekStartsOn) : granularity === "month" ? startOfMonth(from) : from;
  while (cursor <= to) {
    const next = granularity === "day" ? addDays(cursor, 1) : granularity === "week" ? addDays(cursor, 7) : addMonths(cursor, 1);
    const end = addDays(next, -1);
    const label =
      granularity === "day"
        ? formatLocalDate(cursor, { day: "numeric", month: "short" })
        : granularity === "week"
          ? formatLocalDateRange(cursor, end, { day: "numeric", month: "short" })
          : formatLocalDate(cursor, { month: "short", year: "2-digit" });
    buckets.push({ key: cursor, label, start: cursor, end });
    cursor = next;
  }
  return buckets;
}

export function bucketCashFlow(
  transactions: Iterable<Money & { occurredOn: LocalDate }>,
  from: LocalDate,
  to: LocalDate,
  granularity: Granularity,
  weekStartsOn: WeekStart,
): CashFlowBucket[] {
  const buckets = bucketRanges(from, to, granularity, weekStartsOn).map((bucket) => ({
    ...bucket,
    totals: {} as CurrencyTotals,
  }));
  for (const transaction of transactions) {
    if (transaction.occurredOn < from || transaction.occurredOn > to) continue;
    const bucket = buckets.find((candidate) => transaction.occurredOn >= candidate.start && transaction.occurredOn <= candidate.end);
    if (bucket) addTo(bucket.totals, transaction);
  }
  return buckets;
}
