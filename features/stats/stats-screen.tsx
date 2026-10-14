"use client";

import { BarChart3 } from "lucide-react";
import { useMemo } from "react";
import {
  BarList,
  BudgetMeter,
  DurationChart,
  IncomeExpenseChart,
  NetFlowChart,
  type CashFlowPoint,
} from "@/components/charts/charts";
import { CategoryChip, MoneyAmount } from "@/components/domain/display";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useProfile } from "@/features/app/session";
import { useHydrated } from "@/features/app/sync-store";
import { buildDayIndex } from "@/features/calendar/day-index";
import {
  useActivitiesForDays,
  useActivityCategories,
  useActivityCategoryMap,
  useBudgets,
  useFinanceCategoryMap,
  useTransactionsForDays,
} from "@/features/data/hooks";
import { budgetReport, bucketCashFlow, cashFlowByCurrency, currenciesIn, totalsByCategory } from "@/features/finance/calc";
import { isRangePreset, resolveRange, type RangePreset } from "@/features/shared/list-filters";
import { RangePicker } from "@/features/shared/range-picker";
import { useSearchParamState } from "@/features/shared/use-search-param-state";
import { eachDay, formatDuration, formatLocalDate, startOfMonth, todayInZone, type LocalDate, type WeekStart } from "@/lib/dates";
import { toAppError } from "@/lib/errors";
import { CURRENCIES, formatMoney, isCurrency, type Currency } from "@/lib/money";
import type { Transaction } from "@/lib/types";
import { activityTotals, chooseGranularity, minutesByBucket, minutesByCategory } from "./aggregate";

const STATS_PRESETS = ["this-week", "this-month", "last-30", "last-90", "this-year", "custom"] as const satisfies readonly RangePreset[];
/** Statistics compute per-day summaries, so very long custom ranges are capped. */
const MAX_STATS_DAYS = 366 * 3;

function pickCurrency(present: readonly Currency[], requested: string | null, preferred: Currency): Currency {
  if (isCurrency(requested) && present.includes(requested)) return requested;
  if (present.includes(preferred)) return preferred;
  return present[0] ?? preferred;
}

function cashFlowPoints(
  transactions: readonly Transaction[],
  from: LocalDate,
  to: LocalDate,
  weekStartsOn: WeekStart,
  currency: Currency,
): CashFlowPoint[] {
  return bucketCashFlow(transactions, from, to, chooseGranularity(from, to), weekStartsOn).map((bucket) => {
    const flow = bucket.totals[currency];
    return { key: bucket.key, label: bucket.label, income: flow?.income ?? 0, expense: flow?.expense ?? 0, net: flow?.net ?? 0 };
  });
}

export function StatsScreen() {
  const hydrated = useHydrated();
  if (!hydrated) return <Skeleton className="h-[70dvh]" />;
  return <StatsContent />;
}

function StatsContent() {
  const profile = useProfile();
  const [params, setParams] = useSearchParamState();
  const today = todayInZone(profile.timezone);

  const rangeParam = params.get("range");
  const preset: RangePreset =
    isRangePreset(rangeParam) && (STATS_PRESETS as readonly string[]).includes(rangeParam) ? rangeParam : "this-month";
  const resolved = resolveRange(preset, today, profile.weekStartsOn, { from: params.get("from"), to: params.get("to") });
  const tooLong = eachDayCount(resolved.from, resolved.to) > MAX_STATS_DAYS;
  const range = tooLong ? resolveRange("this-year", today, profile.weekStartsOn) : resolved;
  const categoryId = params.get("category");

  const activitiesQuery = useActivitiesForDays(range.from, range.to);
  const transactionsQuery = useTransactionsForDays(range.from, range.to);
  const budgetsQuery = useBudgets(startOfMonth(range.from), startOfMonth(range.to));
  const activityCategoriesQuery = useActivityCategories();
  const activityCategories = useActivityCategoryMap();
  const financeCategories = useFinanceCategoryMap();

  const days = useMemo(() => eachDay(range.from, range.to), [range.from, range.to]);
  const index = useMemo(
    () => buildDayIndex(days, activitiesQuery.data ?? [], [], profile.timezone),
    [days, activitiesQuery.data, profile.timezone],
  );
  const granularity = chooseGranularity(range.from, range.to);

  const totals = useMemo(() => activityTotals(index.values(), categoryId), [index, categoryId]);
  const timeBuckets = useMemo(
    () => minutesByBucket(index, range.from, range.to, granularity, profile.weekStartsOn, categoryId),
    [index, range.from, range.to, granularity, profile.weekStartsOn, categoryId],
  );
  const byCategory = useMemo(() => minutesByCategory(index.values()), [index]);

  const transactions = useMemo(() => transactionsQuery.data ?? [], [transactionsQuery.data]);
  const cash = useMemo(() => cashFlowByCurrency(transactions), [transactions]);
  const currencies = useMemo(() => currenciesIn(cash), [cash]);
  const currency = pickCurrency(currencies, params.get("currency"), profile.currency);
  const flowPoints = useMemo(
    () => cashFlowPoints(transactions, range.from, range.to, profile.weekStartsOn, currency),
    [transactions, range.from, range.to, profile.weekStartsOn, currency],
  );
  const spending = useMemo(() => totalsByCategory(transactions, "expense", currency), [transactions, currency]);
  const budgetLines = useMemo(
    () => budgetReport(budgetsQuery.data ?? [], transactions).filter((line) => line.budget.currency === currency),
    [budgetsQuery.data, transactions, currency],
  );

  const activitiesLoading = activitiesQuery.isPending || activitiesQuery.isPlaceholderData;
  const financeLoading = transactionsQuery.isPending || transactionsQuery.isPlaceholderData;
  const periodLabel = `${formatLocalDate(range.from, { day: "numeric", month: "short", year: "numeric" })} – ${formatLocalDate(range.to, { day: "numeric", month: "short", year: "numeric" })}`;
  const granularityLabel = granularity === "day" ? "per day" : granularity === "week" ? "per week" : "per month";
  const elapsedDays = Math.max(1, Math.min(days.length, eachDayCount(range.from, today < range.to ? today : range.to)));

  return (
    <>
      <PageHeader eyebrow="Analysis" title="Statistics" description={`Based on your saved records · ${periodLabel}`} />

      {/* One filter row scopes every chart below. */}
      <Panel padding="sm" className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <RangePicker
            idPrefix="stats"
            preset={preset}
            from={range.from}
            to={range.to}
            presets={STATS_PRESETS}
            onChange={(next) =>
              setParams({
                range: next.preset,
                from: next.preset === "custom" ? next.from : null,
                to: next.preset === "custom" ? next.to : null,
              })
            }
          />
          <div className="grid gap-1.5">
            <Label htmlFor="stats-category">Activity category</Label>
            <Select id="stats-category" value={categoryId ?? ""} onChange={(event) => setParams({ category: event.target.value })} className="w-44">
              <option value="">All categories</option>
              {(activityCategoriesQuery.data ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>
          {currencies.length > 1 ? (
            <div className="grid gap-1.5">
              <span className="text-xs font-medium tracking-wide text-fg-muted">Currency</span>
              <SegmentedControl<Currency>
                label="Finance currency"
                value={currency}
                onChange={(next) => setParams({ currency: next })}
                options={CURRENCIES.filter((code) => currencies.includes(code)).map((code) => ({ value: code, label: code }))}
              />
            </div>
          ) : null}
        </div>
        {tooLong ? (
          <p role="status" className="mt-2 text-xs text-warn">
            That range is longer than 3 years; showing this year instead.
          </p>
        ) : null}
      </Panel>

      {/* Activity */}
      <section aria-labelledby="stats-activity" className="mb-6 grid gap-4">
        <h2 id="stats-activity" className="hud-label">
          Activity{categoryId ? ` · ${activityCategories.get(categoryId)?.name ?? ""}` : ""}
        </h2>
        {activitiesQuery.error ? (
          <ErrorState message={toAppError(activitiesQuery.error).message} onRetry={() => void activitiesQuery.refetch()} />
        ) : activitiesLoading && !activitiesQuery.data ? (
          <Skeleton className="h-64" />
        ) : totals.minutes === 0 ? (
          <EmptyState icon={<BarChart3 aria-hidden="true" />} title="No tracked time in this period" description="Activities you log appear here." />
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4">
              <Kpi label="Time tracked" value={formatDuration(totals.minutes)} />
              <Kpi label="Activities" value={String(totals.activities)} />
              <Kpi label="Daily average" value={formatDuration(totals.minutes / elapsedDays)} hint={`over ${elapsedDays} ${elapsedDays === 1 ? "day" : "days"}`} />
              <Kpi label="Active days" value={String(totals.activeDays)} />
            </dl>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <Panel title={`Tracked time ${granularityLabel}`} index="01">
                <DurationChart
                  data={timeBuckets}
                  busy={activitiesLoading}
                  title={`Tracked time ${granularityLabel}`}
                  description="Activities crossing midnight count toward each day they cover."
                />
              </Panel>
              <Panel title="Time by category" index="02">
                <BarList
                  title="Share of tracked time"
                  emptyLabel="No tracked time."
                  items={byCategory.map((entry) => {
                    const category = activityCategories.get(entry.categoryId);
                    return {
                      key: entry.categoryId,
                      label: category?.name ?? "Unknown category",
                      swatch: category?.color,
                      value: entry.minutes,
                      display: formatDuration(entry.minutes),
                      share: entry.share,
                    };
                  })}
                />
              </Panel>
            </div>
          </>
        )}
      </section>

      {/* Finance */}
      <section aria-labelledby="stats-finance" className="grid gap-4">
        <h2 id="stats-finance" className="hud-label">
          Finance · {currency}
        </h2>
        {transactionsQuery.error ? (
          <ErrorState message={toAppError(transactionsQuery.error).message} onRetry={() => void transactionsQuery.refetch()} />
        ) : financeLoading && !transactionsQuery.data ? (
          <Skeleton className="h-64" />
        ) : currencies.length === 0 ? (
          <EmptyState icon={<BarChart3 aria-hidden="true" />} title="No transactions in this period" description="Income and expenses you record appear here." />
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4">
              <div className="flex flex-col gap-1 bg-panel px-4 py-3">
                <dt className="hud-label">Income</dt>
                <dd>
                  <MoneyAmount minor={cash[currency]?.income ?? 0} currency={currency} kind="income" className="text-lg" />
                </dd>
              </div>
              <div className="flex flex-col gap-1 bg-panel px-4 py-3">
                <dt className="hud-label">Expenses</dt>
                <dd>
                  <MoneyAmount minor={cash[currency]?.expense ?? 0} currency={currency} kind="expense" className="text-lg" />
                </dd>
              </div>
              <div className="flex flex-col gap-1 bg-panel px-4 py-3">
                <dt className="hud-label">Net cash flow</dt>
                <dd>
                  <MoneyAmount minor={cash[currency]?.net ?? 0} currency={currency} kind="net" className="text-lg" />
                </dd>
              </div>
              <Kpi label="Transactions" value={String(cash[currency]?.count ?? 0)} />
            </dl>
            <div className="grid gap-4 xl:grid-cols-2">
              <Panel title={`Income vs expenses ${granularityLabel}`} index="03">
                <IncomeExpenseChart data={flowPoints} currency={currency} busy={financeLoading} title={`Income vs expenses ${granularityLabel}`} />
              </Panel>
              <Panel title={`Net cash flow ${granularityLabel}`} index="04">
                <NetFlowChart
                  data={flowPoints}
                  currency={currency}
                  busy={financeLoading}
                  title={`Net cash flow ${granularityLabel}`}
                  description="Income minus expenses in each period. Not an account balance."
                />
              </Panel>
              <Panel title="Spending by category" index="05">
                <BarList
                  title={`Expenses · ${currency}`}
                  emptyLabel="No expenses in this currency."
                  items={spending.map((entry) => {
                    const category = financeCategories.get(entry.categoryId);
                    return {
                      key: entry.categoryId,
                      label: category?.name ?? "Unknown category",
                      swatch: category?.color,
                      value: entry.totalMinor,
                      display: formatMoney(entry.totalMinor, currency),
                      share: entry.share,
                    };
                  })}
                />
              </Panel>
              <Panel title="Budget utilization" index="06">
                {budgetLines.length === 0 ? (
                  <p className="text-xs text-fg-subtle">No {currency} budgets in these months.</p>
                ) : (
                  <ul className="grid gap-4">
                    {budgetLines.map(({ budget, usage }) => {
                      const category = financeCategories.get(budget.categoryId);
                      return (
                        <li key={budget.id} className="grid gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <CategoryChip name={category?.name ?? "Unknown"} color={category?.color ?? "#94a3b8"} className="text-sm text-fg" />
                            <span className="text-xs text-fg-subtle">{formatLocalDate(budget.month, { month: "short", year: "numeric" })}</span>
                          </div>
                          <BudgetMeter
                            spentMinor={usage.spentMinor}
                            limitMinor={usage.limitMinor}
                            currency={budget.currency}
                            status={usage.status}
                            label={category?.name ?? "Category"}
                            compact
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Panel>
            </div>
          </>
        )}
      </section>
    </>
  );
}

function eachDayCount(from: LocalDate, to: LocalDate): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 bg-panel px-4 py-3">
      <dt className="hud-label">{label}</dt>
      <dd className="text-lg font-semibold text-fg">
        {value}
        {hint ? <span className="ml-1.5 text-xs font-normal text-fg-subtle">{hint}</span> : null}
      </dd>
    </div>
  );
}
