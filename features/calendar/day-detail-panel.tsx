"use client";

import { Activity as ActivityIcon, ArrowDownRight, ArrowUpRight, Wallet } from "lucide-react";
import { MoneyAmount } from "@/components/domain/display";
import { ActivityRow, TransactionRow } from "@/components/domain/entry-rows";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/panel";
import { currenciesIn } from "@/features/finance/calc";
import { formatDuration, formatLocalDate, type LocalDate } from "@/lib/dates";
import type { Activity, ActivityCategory, FinanceCategory, Transaction } from "@/lib/types";
import type { DaySummary } from "./day-index";

type DayDetailPanelProps = {
  date: LocalDate;
  today: LocalDate;
  summary: DaySummary | undefined;
  timeZone: string;
  activityCategories: Map<string, ActivityCategory>;
  financeCategories: Map<string, FinanceCategory>;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onAddActivity: () => void;
  onAddTransaction: (type: "income" | "expense") => void;
  onOpenActivity: (activity: Activity) => void;
  onOpenTransaction: (transaction: Transaction) => void;
};

export function DayDetailPanel({
  date,
  today,
  summary,
  timeZone,
  activityCategories,
  financeCategories,
  loading,
  error,
  onRetry,
  onAddActivity,
  onAddTransaction,
  onOpenActivity,
  onOpenTransaction,
}: DayDetailPanelProps) {
  const currencies = summary ? currenciesIn(summary.cashFlow) : [];
  const heading = formatLocalDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const incomeCurrencies = currencies.filter((c) => (summary?.cashFlow[c]?.income ?? 0) > 0);
  const expenseCurrencies = currencies.filter((c) => (summary?.cashFlow[c]?.expense ?? 0) > 0);
  const activityCount = summary?.segments.length ?? 0;
  const transactionCount = summary?.transactions.length ?? 0;

  return (
    <Panel
      title={<span aria-live="polite">{heading}</span>}
      actions={date === today ? <Badge variant="accent">Today</Badge> : null}
      aria-label={`Details for ${heading}`}
    >
      <div className="grid gap-4">
        {/* Day totals */}
        <dl className="grid grid-cols-2 gap-2">
          <Stat label="Time tracked">
            {loading && !summary ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <span className="text-base font-semibold tabular-nums text-fg">
                {formatDuration(summary?.activityMinutes ?? 0)}
              </span>
            )}
            <span className="text-xs text-fg-muted">
              {activityCount} {activityCount === 1 ? "activity" : "activities"}
            </span>
          </Stat>
          <Stat label="Net cash flow">
            {currencies.length === 0 ? (
              <span className="text-base font-semibold text-fg-subtle">—</span>
            ) : (
              currencies.map((currency) => (
                <MoneyAmount
                  key={currency}
                  minor={summary?.cashFlow[currency]?.net ?? 0}
                  currency={currency}
                  kind="net"
                  className="text-base font-semibold"
                />
              ))
            )}
            <span className="text-xs text-fg-muted">income − expenses</span>
          </Stat>
          <Stat label="Income">
            {incomeCurrencies.length === 0 ? (
              <span className="text-sm text-fg-subtle">None</span>
            ) : (
              incomeCurrencies.map((currency) => (
                <MoneyAmount
                  key={currency}
                  minor={summary?.cashFlow[currency]?.income ?? 0}
                  currency={currency}
                  kind="income"
                  className="text-sm font-semibold"
                />
              ))
            )}
          </Stat>
          <Stat label="Expenses">
            {expenseCurrencies.length === 0 ? (
              <span className="text-sm text-fg-subtle">None</span>
            ) : (
              expenseCurrencies.map((currency) => (
                <MoneyAmount
                  key={currency}
                  minor={summary?.cashFlow[currency]?.expense ?? 0}
                  currency={currency}
                  kind="expense"
                  className="text-sm font-semibold"
                />
              ))
            )}
          </Stat>
        </dl>

        {/* Quick add for this date */}
        <div className="grid grid-cols-3 gap-2">
          <Button variant="soft" size="sm" className="h-9" onClick={onAddActivity}>
            <ActivityIcon aria-hidden="true" />
            Activity
          </Button>
          <Button variant="income" size="sm" className="h-9" onClick={() => onAddTransaction("income")}>
            <ArrowUpRight aria-hidden="true" />
            Income
          </Button>
          <Button variant="expense" size="sm" className="h-9" onClick={() => onAddTransaction("expense")}>
            <ArrowDownRight aria-hidden="true" />
            Expense
          </Button>
        </div>

        {error ? <ErrorState message={error} onRetry={onRetry} /> : null}

        {/* Activities */}
        <section aria-labelledby="day-activities-heading" className="grid gap-1">
          <SectionHeading id="day-activities-heading" label="Activities" count={activityCount} />
          {loading && !summary ? (
            <ListSkeleton />
          ) : !summary || summary.segments.length === 0 ? (
            <EmptyState
              className="py-5"
              icon={<ActivityIcon aria-hidden="true" />}
              title="No activities logged"
              description="Track what you did and how long it took."
            />
          ) : (
            <ol className="-mx-2.5 grid max-h-[20rem] overflow-y-auto">
              {summary.segments.map((segment) => (
                <li key={`${segment.activity.id}:${segment.date}`}>
                  <ActivityRow
                    activity={segment.activity}
                    category={activityCategories.get(segment.activity.categoryId)}
                    timeZone={timeZone}
                    onOpen={onOpenActivity}
                    continuesBefore={segment.continuesBefore}
                    continuesAfter={segment.continuesAfter}
                    compact
                  />
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Transactions */}
        <section aria-labelledby="day-transactions-heading" className="grid gap-1">
          <SectionHeading id="day-transactions-heading" label="Transactions" count={transactionCount} />
          {loading && !summary ? (
            <ListSkeleton />
          ) : !summary || summary.transactions.length === 0 ? (
            <EmptyState
              className="py-5"
              icon={<Wallet aria-hidden="true" />}
              title="No income or expenses"
              description="Record money in and out for this day."
            />
          ) : (
            <ul className="-mx-2.5 grid max-h-[20rem] overflow-y-auto">
              {summary.transactions.map((transaction) => (
                <li key={transaction.id}>
                  <TransactionRow
                    transaction={transaction}
                    category={financeCategories.get(transaction.categoryId)}
                    onOpen={onOpenTransaction}
                    compact
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Panel>
  );
}

function SectionHeading({ id, label, count }: { id: string; label: string; count: number }) {
  return (
    <h3 id={id} className="flex items-center gap-2 text-[13px] font-semibold text-fg">
      {label}
      <span className="rounded-full bg-muted px-1.5 text-[11px] font-medium leading-5 tabular-nums text-fg-muted">
        {count}
      </span>
    </h3>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-muted px-3 py-2">
      <dt className="text-xs font-medium text-fg-muted">{label}</dt>
      <dd className="flex min-w-0 flex-col gap-0.5">{children}</dd>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="grid gap-1.5" aria-hidden="true">
      <Skeleton className="h-8" />
      <Skeleton className="h-8" />
    </div>
  );
}
