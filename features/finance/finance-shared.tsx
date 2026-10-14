"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { addMonths, formatLocalDate, isValidLocalDate, startOfMonth, type LocalDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/finance", label: "Overview" },
  { href: "/finance/transactions", label: "Transactions" },
  { href: "/finance/budgets", label: "Budgets" },
] as const;

export function FinanceTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Finance sections" className="mb-5 flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--border)]">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active ? "border-accent text-fg" : "border-transparent text-fg-muted hover:border-border-strong hover:text-fg",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Parses ?month=YYYY-MM into the first day of that month, falling back to `fallback`. */
export function parseMonthParam(value: string | null, fallback: LocalDate): LocalDate {
  if (value && /^\d{4}-\d{2}$/.test(value) && isValidLocalDate(`${value}-01`)) return `${value}-01`;
  return startOfMonth(fallback);
}

export function MonthNavigator({
  month,
  currentMonth,
  onChange,
}: {
  month: LocalDate;
  currentMonth: LocalDate;
  onChange: (month: LocalDate) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="min-w-32 text-base font-semibold tracking-tight text-fg" aria-live="polite">
        {formatLocalDate(month, { month: "long", year: "numeric" })}
      </p>
      <div className="flex items-center rounded-lg border border-border-strong bg-surface shadow-card">
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-r-none"
          onClick={() => onChange(addMonths(month, -1))}
          aria-label="Previous month"
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <span className="h-5 w-px bg-border" aria-hidden="true" />
        <Button
          variant="ghost"
          size="sm"
          className="rounded-none px-3 text-fg"
          onClick={() => onChange(currentMonth)}
          disabled={month === currentMonth}
        >
          This month
        </Button>
        <span className="h-5 w-px bg-border" aria-hidden="true" />
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-l-none"
          onClick={() => onChange(addMonths(month, 1))}
          aria-label="Next month"
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
