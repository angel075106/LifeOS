import { describe, expect, it } from "vitest";
import type { Budget, Transaction } from "@/lib/types";
import {
  bucketCashFlow,
  budgetReport,
  budgetUsage,
  cashFlowByCurrency,
  cashFlowByDate,
  currenciesIn,
  totalsByCategory,
} from "./calc";
import { createTransactionInputSchema, setBudgetInputSchema, transactionFormSchema } from "./schema";

let seq = 0;
function tx(partial: Partial<Transaction> & Pick<Transaction, "type" | "amountMinor">): Transaction {
  seq += 1;
  return {
    id: `t${seq}`,
    currency: "EUR",
    occurredOn: "2026-10-14",
    categoryId: "groceries",
    description: null,
    createdAt: "2026-10-14T10:00:00Z",
    updatedAt: "2026-10-14T10:00:00Z",
    ...partial,
  };
}

describe("cash flow", () => {
  it("computes income, expenses and net per currency without mixing currencies", () => {
    const totals = cashFlowByCurrency([
      tx({ type: "income", amountMinor: 250_000 }),
      tx({ type: "expense", amountMinor: 4_550 }),
      tx({ type: "expense", amountMinor: 1_999 }),
      tx({ type: "income", amountMinor: 10_000, currency: "BGN" }),
      tx({ type: "expense", amountMinor: 12_345, currency: "BGN" }),
    ]);
    expect(totals).toEqual({
      EUR: { income: 250_000, expense: 6_549, net: 243_451, count: 3 },
      BGN: { income: 10_000, expense: 12_345, net: -2_345, count: 2 },
    });
    expect(currenciesIn(totals)).toEqual(["EUR", "BGN"]);
  });

  it("is exact for amounts that are inexact in binary floating point", () => {
    // 0.10 + 0.20 must be exactly 0.30
    const totals = cashFlowByCurrency([tx({ type: "expense", amountMinor: 10 }), tx({ type: "expense", amountMinor: 20 })]);
    expect(totals.EUR?.expense).toBe(30);
  });

  it("returns no currencies for an empty period", () => {
    const totals = cashFlowByCurrency([]);
    expect(totals).toEqual({});
    expect(currenciesIn(totals)).toEqual([]);
  });

  it("groups totals by calendar date", () => {
    const byDate = cashFlowByDate([
      tx({ type: "income", amountMinor: 100, occurredOn: "2026-10-13" }),
      tx({ type: "expense", amountMinor: 40, occurredOn: "2026-10-14" }),
      tx({ type: "expense", amountMinor: 60, occurredOn: "2026-10-14" }),
    ]);
    expect(byDate.get("2026-10-13")?.EUR).toEqual({ income: 100, expense: 0, net: 100, count: 1 });
    expect(byDate.get("2026-10-14")?.EUR).toEqual({ income: 0, expense: 100, net: -100, count: 2 });
    expect(byDate.has("2026-10-15")).toBe(false);
  });
});

describe("category totals", () => {
  it("sums one type and currency per category, largest first, with shares", () => {
    const totals = totalsByCategory(
      [
        tx({ type: "expense", amountMinor: 3_000, categoryId: "dining" }),
        tx({ type: "expense", amountMinor: 6_000, categoryId: "groceries" }),
        tx({ type: "expense", amountMinor: 1_000, categoryId: "dining" }),
        tx({ type: "expense", amountMinor: 99_999, categoryId: "dining", currency: "BGN" }),
        tx({ type: "income", amountMinor: 50_000, categoryId: "salary" }),
      ],
      "expense",
      "EUR",
    );
    expect(totals).toEqual([
      { categoryId: "groceries", totalMinor: 6_000, count: 1, share: 0.6 },
      { categoryId: "dining", totalMinor: 4_000, count: 2, share: 0.4 },
    ]);
  });
});

describe("budgets", () => {
  it("classifies usage with an 80% warning threshold", () => {
    expect(budgetUsage(10_000, 7_999).status).toBe("ok");
    expect(budgetUsage(10_000, 8_000).status).toBe("warning");
    expect(budgetUsage(10_000, 10_000).status).toBe("warning");
    expect(budgetUsage(10_000, 10_001).status).toBe("over");
    expect(budgetUsage(10_000, 12_500)).toEqual({
      limitMinor: 10_000,
      spentMinor: 12_500,
      remainingMinor: -2_500,
      ratio: 1.25,
      status: "over",
    });
  });

  it("uses integer arithmetic at the threshold boundary", () => {
    // 80% of 333 is 266.4: 266 is below, 267 is at/above.
    expect(budgetUsage(333, 266).status).toBe("ok");
    expect(budgetUsage(333, 267).status).toBe("warning");
  });

  it("rejects non-positive limits", () => {
    expect(() => budgetUsage(0, 0)).toThrow(RangeError);
  });

  it("counts only expenses of the same category, month and currency", () => {
    const budget: Budget = {
      id: "b1",
      categoryId: "groceries",
      month: "2026-10-01",
      currency: "EUR",
      amountMinor: 40_000,
      createdAt: "",
      updatedAt: "",
    };
    const [line] = budgetReport(
      [budget],
      [
        tx({ type: "expense", amountMinor: 12_000, occurredOn: "2026-10-02" }),
        tx({ type: "expense", amountMinor: 21_000, occurredOn: "2026-10-31" }),
        tx({ type: "expense", amountMinor: 5_000, occurredOn: "2026-11-01" }), // next month
        tx({ type: "expense", amountMinor: 7_000, occurredOn: "2026-10-10", currency: "BGN" }), // other currency
        tx({ type: "expense", amountMinor: 3_000, occurredOn: "2026-10-10", categoryId: "dining" }),
        tx({ type: "income", amountMinor: 9_000, occurredOn: "2026-10-10" }),
      ],
    );
    expect(line.usage.spentMinor).toBe(33_000);
    expect(line.usage.status).toBe("warning");
  });
});

describe("cash flow buckets", () => {
  it("creates weekly buckets including empty weeks", () => {
    const buckets = bucketCashFlow(
      [
        tx({ type: "income", amountMinor: 500, occurredOn: "2026-10-05" }),
        tx({ type: "expense", amountMinor: 200, occurredOn: "2026-10-18" }),
        tx({ type: "expense", amountMinor: 999, occurredOn: "2026-11-01" }), // outside range
      ],
      "2026-10-01",
      "2026-10-31",
      "week",
      1,
    );
    expect(buckets.map((bucket) => bucket.start)).toEqual([
      "2026-09-28",
      "2026-10-05",
      "2026-10-12",
      "2026-10-19",
      "2026-10-26",
    ]);
    expect(buckets[1].totals.EUR?.income).toBe(500);
    expect(buckets[2].totals.EUR?.expense).toBe(200);
    expect(buckets[3].totals).toEqual({});
  });

  it("creates monthly buckets across a year boundary", () => {
    const buckets = bucketCashFlow([], "2026-11-15", "2027-02-10", "month", 1);
    expect(buckets.map((bucket) => bucket.key)).toEqual(["2026-11-01", "2026-12-01", "2027-01-01", "2027-02-01"]);
  });
});

describe("transaction validation", () => {
  const form = {
    type: "expense" as const,
    amount: "12,50",
    currency: "BGN" as const,
    occurredOn: "2026-10-14",
    categoryId: "6f1d1f4e-8f2a-4b7e-9a51-2c1d3e4f5a6b",
    description: "  Corner shop ",
  };

  it("parses form text into integer minor units", () => {
    const result = transactionFormSchema.safeParse(form);
    expect(result.success && result.data).toEqual({
      type: "expense",
      amountMinor: 1250,
      currency: "BGN",
      occurredOn: "2026-10-14",
      categoryId: form.categoryId,
      description: "Corner shop",
    });
  });

  it.each([
    [{ amount: "" }, "amount", "Enter an amount"],
    [{ amount: "0" }, "amount", "Amount must be greater than zero"],
    [{ amount: "1.999" }, "amount", "Use at most 2 decimal places"],
    [{ amount: "-5" }, "amount", "Enter the amount without a sign"],
    [{ occurredOn: "2026-13-01" }, "occurredOn", "Enter a valid date"],
    [{ occurredOn: "1969-12-31" }, "occurredOn", "Choose a date between 1970 and 2199"],
    [{ categoryId: "" }, "categoryId", "Choose a category"],
    [{ description: "d".repeat(201) }, "description", "Keep the description under 200 characters"],
  ])("rejects %j", (patch, path, message) => {
    const result = transactionFormSchema.safeParse({ ...form, ...patch });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(expect.objectContaining({ path: [path], message }));
  });

  it("rejects floating-point or out-of-range amounts on the server", () => {
    const base = {
      id: "0b7a4c1e-2d3f-4a5b-8c6d-7e8f9a0b1c2d",
      type: "income",
      amountMinor: 1050,
      currency: "EUR",
      occurredOn: "2026-10-14",
      categoryId: form.categoryId,
      description: null,
    };
    expect(createTransactionInputSchema.safeParse(base).success).toBe(true);
    expect(createTransactionInputSchema.safeParse({ ...base, amountMinor: 10.5 }).success).toBe(false);
    expect(createTransactionInputSchema.safeParse({ ...base, amountMinor: 0 }).success).toBe(false);
    expect(createTransactionInputSchema.safeParse({ ...base, amountMinor: 10_000_000_000 }).success).toBe(false);
    expect(createTransactionInputSchema.safeParse({ ...base, currency: "USD" }).success).toBe(false);
    expect(createTransactionInputSchema.safeParse({ ...base, type: "transfer" }).success).toBe(false);
  });

  it("only accepts budgets for the first day of a month", () => {
    const budget = { categoryId: form.categoryId, month: "2026-10-01", currency: "EUR", amountMinor: 1000 };
    expect(setBudgetInputSchema.safeParse(budget).success).toBe(true);
    expect(setBudgetInputSchema.safeParse({ ...budget, month: "2026-10-02" }).success).toBe(false);
  });
});
