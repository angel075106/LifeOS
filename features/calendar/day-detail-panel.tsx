"use client";

import { Activity as ActivityIcon, ArrowDownRight, ArrowUpRight } from "lucide-react";
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

  return (
    <Panel
      title={<span aria-live="polite">{heading}</span>}
      index="02"
      actions={date === today ? <Badge variant="cyan">Today</Badge> : null}
      aria-label={`Details for ${heading}`}
    >
      <div className="grid gap-5">
        {/* Totals */}
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line">
          <Stat label="Time tracked">
            {loading && !summary ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <span className="font-mono text-lg text-cyan-soft">{formatDuration(summary?.activityMinutes ?? 0)}</span>
            )}
            <span className="text-xs text-fg-subtle">
              {summary?.segments.length ?? 0} {summary?.segments.length === 1 ? "activity" : "activities"}
            </span>
          </Stat>
          <Stat label="Net cash flow">
            {currencies.length === 0 ? (
              <span className="font-mono text-lg text-fg-subtle">—</span>
            ) : (
              currencies.map((currency) => (
                <MoneyAmount
                  key={currency}
                  minor={summary?.cashFlow[currency]?.net ?? 0}
                  currency={currency}
                  kind="net"
                  className="text-base"
                />
              ))
            )}
            <span className="text-xs text-fg-subtle">income − expenses</span>
          </Stat>
          <Stat label="Income">
            {currencies.filter((c) => (summary?.cashFlow[c]?.income ?? 0) > 0).length === 0 ? (
              <span className="font-mono text-sm text-fg-subtle">None</span>
            ) : (
              currencies.map((currency) =>
                (summary?.cashFlow[currency]?.income ?? 0) > 0 ? (
                  <MoneyAmount key={currency} minor={summary?.cashFlow[currency]?.income ?? 0} currency={currency} kind="income" />
                ) : null,
              )
            )}
          </Stat>
          <Stat label="Expenses">
            {currencies.filter((c) => (summary?.cashFlow[c]?.expense ?? 0) > 0).length === 0 ? (
              <span className="font-mono text-sm text-fg-subtle">None</span>
            ) : (
              currencies.map((currency) =>
                (summary?.cashFlow[currency]?.expense ?? 0) > 0 ? (
                  <MoneyAmount key={currency} minor={summary?.cashFlow[currency]?.expense ?? 0} currency={currency} kind="expense" />
                ) : null,
              )
            )}
          </Stat>
        </dl>

        {/* Quick add for this date */}
        <div className="grid grid-cols-3 gap-2">
          <Button variant="primary" size="sm" className="h-10" onClick={onAddActivity}>
            <ActivityIcon aria-hidden="true" />
            Activity
          </Button>
          <Button variant="income" size="sm" className="h-10" onClick={() => onAddTransaction("income")}>
            <ArrowUpRight aria-hidden="true" />
            Income
          </Button>
          <Button variant="expense" size="sm" className="h-10" onClick={() => onAddTransaction("expense")}>
            <ArrowDownRight aria-hidden="true" />
            Expense
          </Button>
        </div>

        {error ? <ErrorState message={error} onRetry={onRetry} /> : null}

        {/* Activities */}
        <section aria-labelledby="day-activities-heading" className="grid gap-2">
          <h3 id="day-activities-heading" className="hud-label flex items-center justify-between">
            <span>Activities</span>
            <span>{summary?.segments.length ?? 0}</span>
          </h3>
          {loading && !summary ? (
            <ListSkeleton />
          ) : !summary || summary.segments.length === 0 ? (
            <EmptyState
              icon={<ActivityIcon aria-hidden="true" />}
              title="No activities logged"
              description="Track what you did and how long it took."
            />
          ) : (
            <ol className="grid max-h-[22rem] gap-1.5 overflow-y-auto pr-1">
              {summary.segments.map((segment) => (
                <li key={`${segment.activity.id}:${segment.date}`}>
                  <ActivityRow
                    activity={segment.activity}
                    category={activityCategories.get(segment.activity.categoryId)}
                    timeZone={timeZone}
                    onOpen={onOpenActivity}
                    continuesBefore={segment.continuesBefore}
                    continuesAfter={segment.continuesAfter}
                  />
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Transactions */}
        <section aria-labelledby="day-transactions-heading" className="grid gap-2">
          <h3 id="day-transactions-heading" className="hud-label flex items-center justify-between">
            <span>Transactions</span>
            <span>{summary?.transactions.length ?? 0}</span>
          </h3>
          {loading && !summary ? (
            <ListSkeleton />
          ) : !summary || summary.transactions.length === 0 ? (
            <EmptyState
              icon={<ArrowUpRight aria-hidden="true" />}
              title="No income or expenses"
              description="Record money in and out for this day."
            />
          ) : (
            <ul className="grid max-h-[22rem] gap-1.5 overflow-y-auto pr-1">
              {summary.transactions.map((transaction) => (
                <li key={transaction.id}>
                  <TransactionRow
                    transaction={transaction}
                    category={financeCategories.get(transaction.categoryId)}
                    onOpen={onOpenTransaction}
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

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 bg-panel px-3 py-2.5">
      <dt className="hud-label">{label}</dt>
      <dd className="flex min-w-0 flex-col gap-0.5">{children}</dd>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="grid gap-1.5">
      <Skeleton className="h-14" />
      <Skeleton className="h-14" />
    </div>
  );
}
