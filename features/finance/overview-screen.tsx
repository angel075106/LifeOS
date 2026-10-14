"use client";

import { ArrowDownRight, ArrowUpRight, Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { BarList, BudgetMeter, IncomeExpenseChart, type CashFlowPoint } from "@/components/charts/charts";
import { CategoryChip, MoneyAmount } from "@/components/domain/display";
import { TransactionRow } from "@/components/domain/entry-rows";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useProfile } from "@/features/app/session";
import { useHydrated } from "@/features/app/sync-store";
import {
  useBudgets,
  useFinanceCategoryMap,
  useRecentTransactions,
  useTransactionsForDays,
} from "@/features/data/hooks";
import { useEntryDialogs } from "@/features/entries/entry-dialogs";
import { useSearchParamState } from "@/features/shared/use-search-param-state";
import { endOfMonth, formatLocalDate, startOfMonth, todayInZone, type LocalDate, type WeekStart } from "@/lib/dates";
import { toAppError } from "@/lib/errors";
import { CURRENCIES, formatMoney, isCurrency, type Currency } from "@/lib/money";
import type { Transaction } from "@/lib/types";
import { budgetReport, bucketCashFlow, cashFlowByCurrency, currenciesIn, totalsByCategory } from "./calc";
import { FinanceTabs, MonthNavigator, parseMonthParam } from "./finance-shared";

/** The currency charts use: the requested one if present, else the profile's, else any present. */
function pickChartCurrency(present: readonly Currency[], requested: string | null, preferred: Currency): Currency {
  if (isCurrency(requested) && present.includes(requested)) return requested;
  if (present.includes(preferred)) return preferred;
  return present[0] ?? preferred;
}

function dailyPoints(
  transactions: readonly Transaction[],
  month: LocalDate,
  monthEnd: LocalDate,
  weekStartsOn: WeekStart,
  currency: Currency,
): CashFlowPoint[] {
  return bucketCashFlow(transactions, month, monthEnd, "day", weekStartsOn).map((bucket) => {
    const flow = bucket.totals[currency];
    return {
      key: bucket.key,
      label: String(Number(bucket.start.slice(8, 10))),
      income: flow?.income ?? 0,
      expense: flow?.expense ?? 0,
      net: flow?.net ?? 0,
    };
  });
}

export function FinanceOverviewScreen() {
  const hydrated = useHydrated();
  if (!hydrated) return <Skeleton className="h-[70dvh]" />;
  return <FinanceOverviewContent />;
}

function FinanceOverviewContent() {
  const profile = useProfile();
  const { openTransaction } = useEntryDialogs();
  const [params, setParams] = useSearchParamState();
  const today = todayInZone(profile.timezone);
  const currentMonth = startOfMonth(today);
  const month = parseMonthParam(params.get("month"), today);
  const monthEnd = endOfMonth(month);
  const addDate = month === currentMonth ? today : month;

  const transactionsQuery = useTransactionsForDays(month, monthEnd);
  const budgetsQuery = useBudgets(month, month);
  const recentQuery = useRecentTransactions(8);
  const categories = useFinanceCategoryMap();
  const transactions = useMemo(() => transactionsQuery.data ?? [], [transactionsQuery.data]);

  const totals = useMemo(() => cashFlowByCurrency(transactions), [transactions]);
  const currencies = useMemo(() => currenciesIn(totals), [totals]);
  const chartCurrency = pickChartCurrency(currencies, params.get("currency"), profile.currency);

  const daily = useMemo(
    () => dailyPoints(transactions, month, monthEnd, profile.weekStartsOn, chartCurrency),
    [transactions, month, monthEnd, profile.weekStartsOn, chartCurrency],
  );

  const breakdown = (type: "income" | "expense") =>
    totalsByCategory(transactions, type, chartCurrency).map((entry) => {
      const category = categories.get(entry.categoryId);
      return {
        key: entry.categoryId,
        label: category?.name ?? "Unknown category",
        swatch: category?.color,
        value: entry.totalMinor,
        display: formatMoney(entry.totalMinor, chartCurrency),
        share: entry.share,
      };
    });

  const budgetLines = useMemo(
    () => budgetReport(budgetsQuery.data ?? [], transactions).sort((a, b) => b.usage.ratio - a.usage.ratio),
    [budgetsQuery.data, transactions],
  );

  const loading = transactionsQuery.isPending || transactionsQuery.isPlaceholderData;
  const monthLabel = formatLocalDate(month, { month: "long", year: "numeric" });

  return (
    <>
      <PageHeader
        eyebrow="Ledger"
        title="Finance"
        description="Income, expenses and net cash flow. Totals are kept separate per currency."
        actions={
          <>
            <Button variant="income" onClick={() => openTransaction({ mode: "create", date: addDate, type: "income" })}>
              <ArrowUpRight aria-hidden="true" />
              Income
            </Button>
            <Button variant="expense" onClick={() => openTransaction({ mode: "create", date: addDate, type: "expense" })}>
              <ArrowDownRight aria-hidden="true" />
              Expense
            </Button>
          </>
        }
      />
      <FinanceTabs />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <MonthNavigator
          month={month}
          currentMonth={currentMonth}
          onChange={(next) => setParams({ month: next === currentMonth ? null : next.slice(0, 7) })}
        />
        {currencies.length > 1 ? (
          <SegmentedControl<Currency>
            label="Chart currency"
            size="sm"
            value={chartCurrency}
            onChange={(next) => setParams({ currency: next })}
            options={CURRENCIES.filter((currency) => currencies.includes(currency)).map((currency) => ({
              value: currency,
              label: currency,
            }))}
          />
        ) : null}
      </div>

      {transactionsQuery.error ? (
        <ErrorState message={toAppError(transactionsQuery.error).message} onRetry={() => void transactionsQuery.refetch()} />
      ) : null}

      {/* KPI tiles, one row per currency */}
      <section aria-label={`Totals for ${monthLabel}`} className="mb-4 grid gap-3">
        {loading && !transactionsQuery.data ? (
          <Skeleton className="h-24" />
        ) : currencies.length === 0 ? (
          <EmptyState
            icon={<Wallet aria-hidden="true" />}
            title={`No transactions in ${monthLabel}`}
            description="Add income or an expense to see totals and charts."
          />
        ) : (
          currencies.map((currency) => {
            const flow = totals[currency];
            if (!flow) return null;
            return (
              <dl
                key={currency}
                className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4"
                aria-label={`${currency} totals`}
              >
                <Kpi label={`Income · ${currency}`}>
                  <MoneyAmount minor={flow.income} currency={currency} kind="income" className="text-lg" />
                </Kpi>
                <Kpi label={`Expenses · ${currency}`}>
                  <MoneyAmount minor={flow.expense} currency={currency} kind="expense" className="text-lg" />
                </Kpi>
                <Kpi label={`Net cash flow · ${currency}`}>
                  <MoneyAmount minor={flow.net} currency={currency} kind="net" className="text-lg" />
                </Kpi>
                <Kpi label="Transactions">
                  <span className="text-lg font-semibold text-fg">{flow.count}</span>
                </Kpi>
              </dl>
            );
          })
        )}
      </section>

      {currencies.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Panel title={`Daily cash flow · ${chartCurrency}`} index="01">
            <IncomeExpenseChart
              data={daily}
              currency={chartCurrency}
              busy={loading}
              title={`Income vs expenses per day, ${monthLabel}`}
              description="Net cash flow is income minus expenses in the period, not an account balance."
            />
          </Panel>
          <Panel title="Breakdown" index="02">
            <div className="grid gap-6">
              <BarList
                title={`Spending by category · ${chartCurrency}`}
                items={breakdown("expense")}
                emptyLabel="No expenses in this currency."
              />
              <BarList
                title={`Income by category · ${chartCurrency}`}
                items={breakdown("income")}
                emptyLabel="No income in this currency."
              />
            </div>
          </Panel>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel
          title={`Budgets · ${monthLabel}`}
          index="03"
          actions={
            <Link href={`/finance/budgets${month === currentMonth ? "" : `?month=${month.slice(0, 7)}`}`} className="text-xs text-cyan underline-offset-4 hover:underline">
              Manage
            </Link>
          }
        >
          {budgetsQuery.isPending ? (
            <Skeleton className="h-24" />
          ) : budgetLines.length === 0 ? (
            <EmptyState title="No budgets for this month" description="Set monthly limits per expense category." action={
              <Button asChild variant="secondary" size="sm">
                <Link href="/finance/budgets">Set budgets</Link>
              </Button>
            } />
          ) : (
            <ul className="grid gap-4">
              {budgetLines.slice(0, 6).map(({ budget, usage }) => {
                const category = categories.get(budget.categoryId);
                return (
                  <li key={budget.id} className="grid gap-2">
                    <CategoryChip name={category?.name ?? "Unknown"} color={category?.color ?? "#94a3b8"} className="text-sm text-fg" />
                    <BudgetMeter
                      spentMinor={usage.spentMinor}
                      limitMinor={usage.limitMinor}
                      currency={budget.currency}
                      status={usage.status}
                      label={category?.name ?? "Category"}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel
          title="Recent transactions"
          index="04"
          actions={
            <Link href="/finance/transactions" className="text-xs text-cyan underline-offset-4 hover:underline">
              View all
            </Link>
          }
        >
          {recentQuery.error ? (
            <ErrorState message={toAppError(recentQuery.error).message} onRetry={() => void recentQuery.refetch()} />
          ) : recentQuery.isPending ? (
            <Skeleton className="h-40" />
          ) : (recentQuery.data ?? []).length === 0 ? (
            <EmptyState title="No transactions yet" description="Your latest income and expenses will appear here." />
          ) : (
            <ul className="grid gap-1.5">
              {(recentQuery.data ?? []).map((transaction) => (
                <li key={transaction.id}>
                  <TransactionRow
                    transaction={transaction}
                    category={categories.get(transaction.categoryId)}
                    onOpen={(item) => openTransaction({ mode: "edit", transaction: item })}
                    showDate
                  />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

function Kpi({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 bg-panel px-4 py-3">
      <dt className="hud-label">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
