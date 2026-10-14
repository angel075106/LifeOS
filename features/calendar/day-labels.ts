import { currenciesIn } from "@/features/finance/calc";
import { formatDurationLong, formatLocalDate, type LocalDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { DaySummary } from "./day-index";

/** Full spoken description of a day for screen readers (calendar cells and headers). */
export function describeDay(
  date: LocalDate,
  summary: DaySummary | undefined,
  options: { today: boolean; selected: boolean },
): string {
  const parts = [formatLocalDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })];
  if (options.today) parts.push("today");
  if (summary && summary.segments.length > 0) {
    parts.push(
      `${summary.segments.length} ${summary.segments.length === 1 ? "activity" : "activities"}, ${formatDurationLong(summary.activityMinutes)} tracked`,
    );
  } else {
    parts.push("no activities");
  }
  if (summary) {
    for (const currency of currenciesIn(summary.cashFlow)) {
      const totals = summary.cashFlow[currency];
      if (!totals) continue;
      if (totals.income > 0) parts.push(`income ${formatMoney(totals.income, currency)}`);
      if (totals.expense > 0) parts.push(`expenses ${formatMoney(totals.expense, currency)}`);
    }
  }
  if (options.selected) parts.push("selected");
  return parts.join(", ");
}

/** Compact amount for tight calendar cells: "€1,250" / "€12.50". */
export function compactMoney(minor: number, currency: Parameters<typeof formatMoney>[1]): string {
  const full = formatMoney(minor, currency);
  return minor % 100 === 0 ? full.replace(/[.,]00(?=$|\D*$)/, "") : full;
}
