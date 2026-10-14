"use client";

import { ArrowDownRight, ArrowUpRight, Receipt, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { MoneyAmount } from "@/components/domain/display";
import { TransactionRow } from "@/components/domain/entry-rows";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { useProfile } from "@/features/app/session";
import { useHydrated } from "@/features/app/sync-store";
import { useFinanceCategories, useFinanceCategoryMap, useTransactionsForDays } from "@/features/data/hooks";
import { useEntryDialogs } from "@/features/entries/entry-dialogs";
import {
  filterTransactions,
  groupByDate,
  isRangePreset,
  limitGroups,
  resolveRange,
  type RangePreset,
} from "@/features/shared/list-filters";
import { RangePicker } from "@/features/shared/range-picker";
import { useSearchParamState } from "@/features/shared/use-search-param-state";
import { formatLocalDate, todayInZone } from "@/lib/dates";
import { toAppError } from "@/lib/errors";
import { CURRENCIES, isCurrency } from "@/lib/money";
import { TRANSACTION_TYPES, type TransactionType } from "@/lib/types";
import { cashFlowByCurrency, currenciesIn } from "./calc";
import { FinanceTabs } from "./finance-shared";

const PAGE_SIZE = 100;

function isTransactionType(value: unknown): value is TransactionType {
  return typeof value === "string" && (TRANSACTION_TYPES as readonly string[]).includes(value);
}

export function TransactionsScreen() {
  const hydrated = useHydrated();
  if (!hydrated) return <Skeleton className="h-[70dvh]" />;
  return <TransactionsContent />;
}

function TransactionsContent() {
  const profile = useProfile();
  const { openTransaction } = useEntryDialogs();
  const [params, setParams] = useSearchParamState();
  const [visible, setVisible] = useState(PAGE_SIZE);
  const today = todayInZone(profile.timezone);

  const rangeParam = params.get("range");
  const preset: RangePreset = isRangePreset(rangeParam) ? rangeParam : "this-month";
  const range = resolveRange(preset, today, profile.weekStartsOn, { from: params.get("from"), to: params.get("to") });
  const query = params.get("q") ?? "";
  const typeParam = params.get("type");
  const type = isTransactionType(typeParam) ? typeParam : null;
  const categoryId = params.get("category");
  const currencyParam = params.get("currency");
  const currency = isCurrency(currencyParam) ? currencyParam : null;
  const sort = params.get("sort") === "oldest" ? "oldest" : "newest";

  const transactionsQuery = useTransactionsForDays(range.from, range.to);
  const categoriesQuery = useFinanceCategories();
  const categoryMap = useFinanceCategoryMap();

  const filtered = useMemo(
    () =>
      filterTransactions(
        transactionsQuery.data ?? [],
        { query, type, categoryId, currency },
        (id) => categoryMap.get(id)?.name,
      ),
    [transactionsQuery.data, query, type, categoryId, currency, categoryMap],
  );
  const totals = useMemo(() => cashFlowByCurrency(filtered), [filtered]);
  const groups = useMemo(
    () => groupByDate(filtered, (transaction) => transaction.occurredOn, (transaction) => transaction.createdAt, sort),
    [filtered, sort],
  );

  // Whole day groups, until roughly `visible` items are shown.
  const shownGroups = useMemo(() => limitGroups(groups, visible), [groups, visible]);

  const categoryOptions = (categoriesQuery.data ?? []).filter((category) => !type || category.kind === type);
  const hasFilters = Boolean(query || type || categoryId || currency);
  const clearFilters = () => setParams({ q: null, type: null, category: null, currency: null });
  const loading = transactionsQuery.isPending || transactionsQuery.isPlaceholderData;
  const addDate = range.from <= today && today <= range.to ? today : range.to;

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Search and filter every income and expense entry."
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

      <Panel padding="sm" className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid min-w-48 flex-1 gap-1.5">
            <Label htmlFor="transaction-search">Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
              <Input
                id="transaction-search"
                type="search"
                value={query}
                onChange={(event) => setParams({ q: event.target.value })}
                placeholder="Description or category"
                className="pl-9"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="transaction-type-filter">Type</Label>
            <Select
              id="transaction-type-filter"
              value={type ?? ""}
              onChange={(event) => setParams({ type: event.target.value, category: null })}
              className="w-32"
            >
              <option value="">All types</option>
              <option value="income">Income</option>
              <option value="expense">Expenses</option>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="transaction-category-filter">Category</Label>
            <Select
              id="transaction-category-filter"
              value={categoryId ?? ""}
              onChange={(event) => setParams({ category: event.target.value })}
              className="w-44"
            >
              <option value="">All categories</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} ({category.kind === "income" ? "income" : "expense"})
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="transaction-currency-filter">Currency</Label>
            <Select
              id="transaction-currency-filter"
              value={currency ?? ""}
              onChange={(event) => setParams({ currency: event.target.value })}
              className="w-28"
            >
              <option value="">All</option>
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Select>
          </div>
          <RangePicker
            idPrefix="transactions"
            preset={preset}
            from={range.from}
            to={range.to}
            onChange={(next) =>
              setParams({
                range: next.preset,
                from: next.preset === "custom" ? next.from : null,
                to: next.preset === "custom" ? next.to : null,
              })
            }
          />
          <div className="grid gap-1.5">
            <Label htmlFor="transaction-sort">Order</Label>
            <Select id="transaction-sort" value={sort} onChange={(event) => setParams({ sort: event.target.value })} className="w-36">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </Select>
          </div>
        </div>
      </Panel>

      {/* Exact totals for everything matching the filters, per currency */}
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm" aria-live="polite">
        <span className="text-fg-muted">
          <span className="font-semibold tabular-nums text-fg">{filtered.length}</span> {filtered.length === 1 ? "transaction" : "transactions"}
        </span>
        {currenciesIn(totals).map((code) => {
          const flow = totals[code];
          if (!flow) return null;
          return (
            <span key={code} className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
              <MoneyAmount minor={flow.income} currency={code} kind="income" />
              <MoneyAmount minor={flow.expense} currency={code} kind="expense" />
              <span className="inline-flex items-center gap-1 text-fg-muted">
                net <MoneyAmount minor={flow.net} currency={code} kind="net" showIcon={false} />
              </span>
            </span>
          );
        })}
        {hasFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 text-xs font-medium text-accent-text underline-offset-4 hover:underline"
          >
            <X className="size-3" aria-hidden="true" />
            Clear filters
          </button>
        ) : null}
      </div>

      {transactionsQuery.error ? (
        <ErrorState message={toAppError(transactionsQuery.error).message} onRetry={() => void transactionsQuery.refetch()} />
      ) : loading && !transactionsQuery.data ? (
        <div className="grid gap-2">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<Receipt aria-hidden="true" />}
          title={hasFilters ? "No transactions match these filters" : "No transactions in this period"}
          description={hasFilters ? "Try a different search or clear the filters." : "Add income or an expense to get started."}
          action={
            hasFilters ? (
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null
          }
        />
      ) : (
        <div className={loading ? "grid gap-6 opacity-60 transition-opacity" : "grid gap-6"} aria-busy={loading}>
          {shownGroups.map((group) => (
            <section key={group.date} aria-labelledby={`tx-day-${group.date}`} className="grid gap-2">
              <h2 id={`tx-day-${group.date}`} className="flex items-center gap-2 px-1 text-[13px] font-semibold text-fg">
                <span>
                  {formatLocalDate(group.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                </span>
                {group.date === today ? <span className="text-xs font-medium text-accent-text">Today</span> : null}
                <span className="ml-auto rounded-full bg-muted px-1.5 text-[11px] font-medium leading-5 tabular-nums text-fg-muted">
                  {group.items.length}
                </span>
              </h2>
              <ul className="grid gap-0.5 rounded-xl border border-border bg-surface p-1.5 shadow-card">
                {group.items.map((transaction) => (
                  <li key={transaction.id}>
                    <TransactionRow
                      transaction={transaction}
                      category={categoryMap.get(transaction.categoryId)}
                      onOpen={(item) => openTransaction({ mode: "edit", transaction: item })}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {shownGroups.length < groups.length ? (
            <Button variant="secondary" className="justify-self-center" onClick={() => setVisible((count) => count + PAGE_SIZE)}>
              Show more
            </Button>
          ) : null}
        </div>
      )}
    </>
  );
}
