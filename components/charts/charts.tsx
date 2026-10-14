"use client";

import { AlertTriangle, CheckCircle2, OctagonAlert } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { BudgetStatus } from "@/features/finance/calc";
import { formatDuration } from "@/lib/dates";
import { formatMoney, type Currency } from "@/lib/money";
import { cn } from "@/lib/utils";
import { ChartFrame, ChartTable } from "./chart-frame";

export const CHART_COLORS = {
  income: "var(--chart-income)",
  expense: "var(--chart-expense)",
  accent: "var(--chart-accent)",
} as const;

const AXIS_TICK = { fill: "var(--fg-subtle)", fontSize: 11 } as const;
const GRID_STROKE = "var(--chart-grid)";
const AXIS_STROKE = "var(--border-strong)";
const CURSOR = { fill: "var(--muted)", fillOpacity: 0.8 };

function compactMoneyTick(minor: number, currency: Currency): string {
  // Axis ticks only: compact display may round; exact values are in tooltips and tables.
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(minor / 100);
}

function hoursTick(minutes: number): string {
  return minutes === 0 ? "0" : `${Math.round(minutes / 60)}h`;
}

/** Y-axis ticks on whole hours (0, 2h, 4h …) with at most five steps. */
export function hourTicks(maxMinutes: number): number[] {
  const maxHours = Math.max(1, Math.ceil(maxMinutes / 60));
  const step = [1, 2, 3, 4, 6, 8, 12, 24, 48, 96, 168].find((candidate) => maxHours / candidate <= 5) ?? Math.ceil(maxHours / 5);
  const ticks: number[] = [];
  for (let hours = 0; hours <= Math.ceil(maxHours / step) * step; hours += step) ticks.push(hours * 60);
  return ticks;
}

type TooltipRow = { label: string; color: string; value: string };

/** Values lead, series names follow; series keyed with a short line in the series color. */
function ChartTooltipBody({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="min-w-36 rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs shadow-popover">
      <p className="mb-1 text-fg-muted">{title}</p>
      <ul className="grid gap-1">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2">
            <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: row.color }} aria-hidden="true" />
            <span className="font-semibold tabular-nums text-fg">{row.value}</span>
            <span className="text-fg-muted">{row.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Income vs expenses (grouped columns, one currency)
// ---------------------------------------------------------------------------

export type CashFlowPoint = { key: string; label: string; income: number; expense: number; net: number };

export function IncomeExpenseChart({
  data,
  currency,
  title,
  description,
  busy,
  hideTitle,
}: {
  data: CashFlowPoint[];
  currency: Currency;
  title: string;
  description?: string;
  busy?: boolean;
  hideTitle?: boolean;
}) {
  const money = (value: number) => formatMoney(value, currency);
  return (
    <ChartFrame
      title={title}
      description={description}
      busy={busy}
      hideTitle={hideTitle}
      legend={[
        { label: "Income", color: CHART_COLORS.income },
        { label: "Expenses", color: CHART_COLORS.expense },
      ]}
      table={
        <ChartTable
          caption={title}
          columns={["Period", "Income", "Expenses", "Net"]}
          rows={data.map((point) => ({
            key: point.key,
            cells: [point.label, money(point.income), money(point.expense), formatMoney(point.net, currency, { signDisplay: "exceptZero" })],
          }))}
        />
      }
    >
      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap="22%" margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: AXIS_STROKE }} minTickGap={8} />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={58}
              tickFormatter={(value: number) => compactMoneyTick(value, currency)}
            />
            <Tooltip
              cursor={CURSOR}
              content={(props: TooltipContentProps) => {
                const point = props.payload?.[0]?.payload as CashFlowPoint | undefined;
                if (!props.active || !point) return null;
                return (
                  <ChartTooltipBody
                    title={point.label}
                    rows={[
                      { label: "Income", color: CHART_COLORS.income, value: money(point.income) },
                      { label: "Expenses", color: CHART_COLORS.expense, value: money(point.expense) },
                      { label: "Net", color: "var(--fg-subtle)", value: formatMoney(point.net, currency, { signDisplay: "exceptZero" }) },
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="income" name="Income" fill={CHART_COLORS.income} radius={[4, 4, 0, 0]} maxBarSize={24} />
            <Bar dataKey="expense" name="Expenses" fill={CHART_COLORS.expense} radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

// ---------------------------------------------------------------------------
// Net cash flow (diverging columns around zero)
// ---------------------------------------------------------------------------

export function NetFlowChart({
  data,
  currency,
  title,
  description,
  busy,
  hideTitle,
}: {
  data: CashFlowPoint[];
  currency: Currency;
  title: string;
  description?: string;
  busy?: boolean;
  hideTitle?: boolean;
}) {
  return (
    <ChartFrame
      title={title}
      description={description}
      busy={busy}
      hideTitle={hideTitle}
      table={
        <ChartTable
          caption={title}
          columns={["Period", "Net cash flow"]}
          rows={data.map((point) => ({
            key: point.key,
            cells: [point.label, formatMoney(point.net, currency, { signDisplay: "exceptZero" })],
          }))}
        />
      }
    >
      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="22%" margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={8} />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={58}
              tickFormatter={(value: number) => compactMoneyTick(value, currency)}
            />
            <ReferenceLine y={0} stroke={AXIS_STROKE} />
            <Tooltip
              cursor={CURSOR}
              content={(props: TooltipContentProps) => {
                const point = props.payload?.[0]?.payload as CashFlowPoint | undefined;
                if (!props.active || !point) return null;
                return (
                  <ChartTooltipBody
                    title={point.label}
                    rows={[
                      {
                        label: point.net >= 0 ? "Net inflow" : "Net outflow",
                        color: point.net >= 0 ? CHART_COLORS.income : CHART_COLORS.expense,
                        value: formatMoney(point.net, currency, { signDisplay: "exceptZero" }),
                      },
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="net" name="Net cash flow" radius={[4, 4, 4, 4]} maxBarSize={24}>
              {data.map((point) => (
                <Cell key={point.key} fill={point.net >= 0 ? CHART_COLORS.income : CHART_COLORS.expense} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

// ---------------------------------------------------------------------------
// Tracked time per period (single series columns)
// ---------------------------------------------------------------------------

export type DurationPoint = { key: string; label: string; minutes: number };

export function DurationChart({
  data,
  title,
  description,
  busy,
  hideTitle,
}: {
  data: DurationPoint[];
  title: string;
  description?: string;
  busy?: boolean;
  hideTitle?: boolean;
}) {
  return (
    <ChartFrame
      title={title}
      description={description}
      busy={busy}
      hideTitle={hideTitle}
      table={
        <ChartTable
          caption={title}
          columns={["Period", "Tracked time"]}
          rows={data.map((point) => ({ key: point.key, cells: [point.label, formatDuration(point.minutes)] }))}
        />
      }
    >
      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="22%" margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: AXIS_STROKE }} minTickGap={8} />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={40}
              ticks={hourTicks(Math.max(0, ...data.map((point) => point.minutes)))}
              domain={[0, "dataMax"]}
              tickFormatter={hoursTick}
            />
            <Tooltip
              cursor={CURSOR}
              content={(props: TooltipContentProps) => {
                const point = props.payload?.[0]?.payload as DurationPoint | undefined;
                if (!props.active || !point) return null;
                return (
                  <ChartTooltipBody
                    title={point.label}
                    rows={[{ label: "Tracked", color: CHART_COLORS.accent, value: formatDuration(point.minutes) }]}
                  />
                );
              }}
            />
            <Bar dataKey="minutes" name="Tracked time" fill={CHART_COLORS.accent} radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

// ---------------------------------------------------------------------------
// Ranked breakdown (HTML bar list: every value directly labeled)
// ---------------------------------------------------------------------------

export type BarListItem = { key: string; label: string; swatch?: string; value: number; display: string; share: number };

export function BarList({ items, title, emptyLabel }: { items: BarListItem[]; title: string; emptyLabel: string }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <figure className="grid gap-3">
      <figcaption className="text-sm font-medium text-fg">{title}</figcaption>
      {items.length === 0 ? (
        <p className="text-xs text-fg-subtle">{emptyLabel}</p>
      ) : (
        <ul className="grid gap-2.5">
          {items.map((item) => (
            <li key={item.key} className="grid gap-1">
              <div className="flex items-center gap-2 text-xs">
                {item.swatch ? (
                  <span className="size-2 shrink-0 rounded-full ring-1 ring-fg/10" style={{ backgroundColor: item.swatch }} aria-hidden="true" />
                ) : null}
                <span className="min-w-0 flex-1 truncate text-fg">{item.label}</span>
                <span className="font-medium tabular-nums text-fg">{item.display}</span>
                <span className="w-10 text-right tabular-nums text-fg-subtle">{Math.round(item.share * 100)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted-strong" aria-hidden="true">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(2, (item.value / max) * 100)}%`, backgroundColor: CHART_COLORS.accent }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Budget meter
// ---------------------------------------------------------------------------

const BUDGET_STATUS: Record<BudgetStatus, { label: string; icon: typeof CheckCircle2; text: string; fill: string; track: string }> = {
  ok: { label: "On track", icon: CheckCircle2, text: "text-fg-muted", fill: "var(--chart-accent)", track: "var(--muted-strong)" },
  warning: { label: "Near limit", icon: AlertTriangle, text: "text-warning", fill: "var(--warning)", track: "var(--warning-soft)" },
  over: { label: "Over budget", icon: OctagonAlert, text: "text-expense", fill: "var(--chart-expense)", track: "var(--expense-soft)" },
};

export function BudgetMeter({
  spentMinor,
  limitMinor,
  currency,
  status,
  label,
  compact = false,
}: {
  spentMinor: number;
  limitMinor: number;
  currency: Currency;
  status: BudgetStatus;
  label: string;
  compact?: boolean;
}) {
  const config = BUDGET_STATUS[status];
  const Icon = config.icon;
  const percent = Math.round((spentMinor / limitMinor) * 100);
  const remaining = limitMinor - spentMinor;
  return (
    <div className="grid gap-1.5">
      <div
        role="meter"
        aria-label={`${label} budget`}
        aria-valuemin={0}
        aria-valuemax={limitMinor}
        aria-valuenow={Math.min(spentMinor, limitMinor)}
        aria-valuetext={`${formatMoney(spentMinor, currency)} of ${formatMoney(limitMinor, currency)} spent, ${percent}%, ${config.label}`}
        className="h-2 overflow-hidden rounded-full"
        style={{ backgroundColor: config.track }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${Math.min(100, Math.max(spentMinor > 0 ? 2 : 0, percent))}%`, backgroundColor: config.fill }}
        />
      </div>
      <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs", compact && "text-[11px]")}>
        <span className={cn("inline-flex items-center gap-1 font-medium", config.text)}>
          <Icon className="size-3.5" aria-hidden="true" />
          {config.label}
        </span>
        <span className="tabular-nums text-fg">
          {formatMoney(spentMinor, currency)} <span className="text-fg-subtle">/ {formatMoney(limitMinor, currency)}</span>
        </span>
        <span className="tabular-nums text-fg-subtle">{percent}%</span>
        <span className={cn("ml-auto tabular-nums", remaining < 0 ? "text-expense" : "text-fg-muted")}>
          {remaining < 0 ? `${formatMoney(-remaining, currency)} over` : `${formatMoney(remaining, currency)} left`}
        </span>
      </div>
    </div>
  );
}
