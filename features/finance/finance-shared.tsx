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
    <nav aria-label="Finance sections" className="mb-4 flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-line)]">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors",
              active ? "border-cyan text-fg" : "border-transparent text-fg-muted hover:text-fg",
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
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" onClick={() => onChange(addMonths(month, -1))} aria-label="Previous month">
        <ChevronLeft aria-hidden="true" />
      </Button>
      <p className="min-w-36 text-center text-base font-semibold text-fg" aria-live="polite">
        {formatLocalDate(month, { month: "long", year: "numeric" })}
      </p>
      <Button variant="ghost" size="icon" onClick={() => onChange(addMonths(month, 1))} aria-label="Next month">
        <ChevronRight aria-hidden="true" />
      </Button>
      <Button variant="secondary" size="sm" className="h-9" onClick={() => onChange(currentMonth)} disabled={month === currentMonth}>
        This month
      </Button>
    </div>
  );
}
