"use client";

import { Copy, PiggyBank, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { BudgetMeter } from "@/components/charts/charts";
import { CategoryChip, MoneyAmount } from "@/components/domain/display";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useToast } from "@/components/ui/toast";
import { useProfile } from "@/features/app/session";
import { useHydrated } from "@/features/app/sync-store";
import { useBudgets, useFinanceCategories, useTransactionsForDays } from "@/features/data/hooks";
import { describeMutationError, useActionMutation } from "@/features/data/mutations";
import { useSearchParamState } from "@/features/shared/use-search-param-state";
import { addMonths, endOfMonth, formatLocalDate, startOfMonth, todayInZone, type LocalDate } from "@/lib/dates";
import { toAppError } from "@/lib/errors";
import { CURRENCIES, formatMoney, minorToDecimalString, parseAmountToMinor, type Currency } from "@/lib/money";
import type { Budget, FinanceCategory, Transaction } from "@/lib/types";
import { copyBudgets, deleteBudget, setBudget } from "./actions";
import { budgetUsage, totalsByCategory } from "./calc";
import { FinanceTabs, MonthNavigator, parseMonthParam } from "./finance-shared";

export function BudgetsScreen() {
  const hydrated = useHydrated();
  if (!hydrated) return <Skeleton className="h-[70dvh]" />;
  return <BudgetsContent />;
}

function BudgetsContent() {
  const profile = useProfile();
  const toast = useToast();
  const [params, setParams] = useSearchParamState();
  const today = todayInZone(profile.timezone);
  const currentMonth = startOfMonth(today);
  const month = parseMonthParam(params.get("month"), today);
  const previousMonth = addMonths(month, -1);
  const [newCurrency, setNewCurrency] = useState<Currency>(profile.currency);

  const budgetsQuery = useBudgets(month, month);
  const categoriesQuery = useFinanceCategories();
  const transactionsQuery = useTransactionsForDays(month, endOfMonth(month));
  const copy = useActionMutation(copyBudgets, ["budgets"]);

  const budgets = useMemo(() => budgetsQuery.data ?? [], [budgetsQuery.data]);
  const transactions = useMemo(() => transactionsQuery.data ?? [], [transactionsQuery.data]);

  const expenseCategories = useMemo(
    () =>
      (categoriesQuery.data ?? []).filter(
        (category) =>
          category.kind === "expense" &&
          (!category.isArchived || budgets.some((budget) => budget.categoryId === category.id)),
      ),
    [categoriesQuery.data, budgets],
  );

  const spentByCurrency = useMemo(() => {
    const map = new Map<string, number>();
    for (const currency of CURRENCIES) {
      for (const entry of totalsByCategory(transactions, "expense", currency)) {
        map.set(`${entry.categoryId}|${currency}`, entry.totalMinor);
      }
    }
    return map;
  }, [transactions]);

  const monthLabel = formatLocalDate(month, { month: "long", year: "numeric" });
  const previousLabel = formatLocalDate(previousMonth, { month: "long" });
  const loading = budgetsQuery.isPending || categoriesQuery.isPending || transactionsQuery.isPending;
  const error = budgetsQuery.error ?? categoriesQuery.error ?? transactionsQuery.error;

  async function handleCopy() {
    try {
      const { copied } = await copy.mutateAsync({ fromMonth: previousMonth, toMonth: month });
      if (copied === 0) toast.info(`Nothing to copy`, `No new budgets found in ${previousLabel} for active categories.`);
      else toast.success(`Copied ${copied} ${copied === 1 ? "budget" : "budgets"} from ${previousLabel}`);
    } catch (caught) {
      toast.error("Couldn't copy budgets", describeMutationError(caught).message);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Ledger"
        title="Budgets"
        description="Monthly spending limits per expense category. Only expenses in the budget's currency count toward it."
      />
      <FinanceTabs />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <MonthNavigator
          month={month}
          currentMonth={currentMonth}
          onChange={(next) => setParams({ month: next === currentMonth ? null : next.slice(0, 7) })}
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-fg-muted" id="new-budget-currency">
            New budgets in
          </span>
          <SegmentedControl<Currency>
            label="Currency for new budgets"
            size="sm"
            value={newCurrency}
            onChange={setNewCurrency}
            options={CURRENCIES.map((currency) => ({ value: currency, label: currency }))}
          />
          <Button variant="secondary" size="sm" className="h-9" onClick={handleCopy} loading={copy.isPending}>
            {!copy.isPending ? <Copy aria-hidden="true" /> : null}
            Copy from {previousLabel}
          </Button>
        </div>
      </div>

      {error ? <ErrorState message={toAppError(error).message} onRetry={() => void budgetsQuery.refetch()} /> : null}

      <Panel title={`Expense categories · ${monthLabel}`} index="01">
        {loading ? (
          <div className="grid gap-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : expenseCategories.length === 0 ? (
          <EmptyState
            icon={<PiggyBank aria-hidden="true" />}
            title="No expense categories"
            description="Create expense categories in Settings to set budgets."
          />
        ) : (
          <ul className="divide-y divide-line">
            {expenseCategories.map((category) => (
              <CategoryBudgetRow
                key={category.id}
                category={category}
                month={month}
                newCurrency={newCurrency}
                budgets={budgets.filter((budget) => budget.categoryId === category.id)}
                spent={(currency) => spentByCurrency.get(`${category.id}|${currency}`) ?? 0}
                transactions={transactions}
              />
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

function CategoryBudgetRow({
  category,
  month,
  newCurrency,
  budgets,
  spent,
}: {
  category: FinanceCategory;
  month: LocalDate;
  newCurrency: Currency;
  budgets: Budget[];
  spent: (currency: Currency) => number;
  transactions: Transaction[];
}) {
  const hasNewCurrencyBudget = budgets.some((budget) => budget.currency === newCurrency);
  const unbudgeted = CURRENCIES.filter(
    (currency) => spent(currency) > 0 && !budgets.some((budget) => budget.currency === currency),
  );

  return (
    <li className="grid gap-3 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <CategoryChip name={category.name} color={category.color} archived={category.isArchived} className="text-sm text-fg" />
        {unbudgeted.map((currency) => (
          <span key={currency} className="ml-auto inline-flex items-center gap-1 text-xs text-fg-muted">
            No {currency} budget · spent <MoneyAmount minor={spent(currency)} currency={currency} kind="plain" />
          </span>
        ))}
      </div>
      {budgets.map((budget) => (
        <ExistingBudget key={budget.id} budget={budget} categoryName={category.name} spentMinor={spent(budget.currency)} />
      ))}
      {!hasNewCurrencyBudget && !category.isArchived ? (
        <BudgetAmountForm categoryId={category.id} categoryName={category.name} month={month} currency={newCurrency} />
      ) : null}
    </li>
  );
}

function ExistingBudget({ budget, categoryName, spentMinor }: { budget: Budget; categoryName: string; spentMinor: number }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const remove = useActionMutation(deleteBudget, ["budgets"]);
  const usage = budgetUsage(budget.amountMinor, spentMinor);

  return (
    <div className="grid gap-2 rounded-hud border border-line bg-base/40 p-3">
      {editing ? (
        <BudgetAmountForm
          categoryId={budget.categoryId}
          categoryName={categoryName}
          month={budget.month}
          currency={budget.currency}
          initialMinor={budget.amountMinor}
          onDone={() => setEditing(false)}
        />
      ) : (
        <>
          <BudgetMeter
            spentMinor={usage.spentMinor}
            limitMinor={usage.limitMinor}
            currency={budget.currency}
            status={usage.status}
            label={`${categoryName} ${budget.currency}`}
          />
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              Edit limit
            </Button>
            <Button variant="ghost" size="sm" className="text-expense hover:text-expense" onClick={() => setConfirmDelete(true)}>
              <Trash2 aria-hidden="true" />
              Remove
            </Button>
          </div>
        </>
      )}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Remove this budget?"
        confirmLabel="Remove"
        description={
          <>
            The {formatMoney(budget.amountMinor, budget.currency)} limit for <strong className="text-fg">{categoryName}</strong>{" "}
            will be removed for this month. Transactions are not affected.
          </>
        }
        onConfirm={async () => {
          try {
            await remove.mutateAsync({ id: budget.id });
            toast.success("Budget removed");
            return true;
          } catch (caught) {
            toast.error("Couldn't remove the budget", describeMutationError(caught).message);
            return false;
          }
        }}
      />
    </div>
  );
}

function BudgetAmountForm({
  categoryId,
  categoryName,
  month,
  currency,
  initialMinor,
  onDone,
}: {
  categoryId: string;
  categoryName: string;
  month: LocalDate;
  currency: Currency;
  initialMinor?: number;
  onDone?: () => void;
}) {
  const toast = useToast();
  const [amount, setAmount] = useState(initialMinor ? minorToDecimalString(initialMinor, currency) : "");
  const [error, setError] = useState<string | null>(null);
  const save = useActionMutation(setBudget, ["budgets"]);
  const inputId = `budget-${categoryId}-${currency}`;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (save.isPending) return;
    const parsed = parseAmountToMinor(amount, currency);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    try {
      const saved = await save.mutateAsync({ categoryId, month, currency, amountMinor: parsed.minor });
      toast.success(`Budget saved for ${categoryName}`, formatMoney(saved.amountMinor, saved.currency));
      if (!initialMinor) setAmount("");
      onDone?.();
    } catch (caught) {
      setError(describeMutationError(caught).message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-start gap-2" noValidate>
      <div className="grid gap-1">
        <label htmlFor={inputId} className="sr-only">
          {categoryName} monthly budget in {currency}
        </label>
        <div className="relative">
          <Input
            id={inputId}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            autoComplete="off"
            placeholder={initialMinor ? undefined : "Monthly limit"}
            className="w-40 pr-12 font-mono"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${inputId}-error` : undefined}
            disabled={save.isPending}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-fg-subtle">
            {currency}
          </span>
        </div>
        {error ? (
          <p id={`${inputId}-error`} role="alert" className="text-xs text-expense">
            {error}
          </p>
        ) : null}
      </div>
      <Button type="submit" variant="primary" size="md" loading={save.isPending}>
        {initialMinor ? "Save limit" : "Set budget"}
      </Button>
      {onDone ? (
        <Button variant="ghost" onClick={onDone} disabled={save.isPending}>
          Cancel
        </Button>
      ) : null}
    </form>
  );
}
