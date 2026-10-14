import { describe, expect, it } from "vitest";
import type { Activity, Transaction } from "@/lib/types";
import {
  filterActivities,
  filterTransactions,
  groupByDate,
  limitGroups,
  matchesText,
  monthsInRange,
  resolveRange,
} from "./list-filters";

describe("resolveRange", () => {
  const today = "2026-10-14";
  it.each([
    ["this-week", { from: "2026-10-12", to: "2026-10-18" }],
    ["this-month", { from: "2026-10-01", to: "2026-10-31" }],
    ["last-30", { from: "2026-09-15", to: "2026-10-14" }],
    ["last-90", { from: "2026-07-17", to: "2026-10-14" }],
    ["this-year", { from: "2026-01-01", to: "2026-12-31" }],
    ["all", { from: "1970-01-01", to: "2199-12-31" }],
  ] as const)("resolves %s", (preset, expected) => {
    expect(resolveRange(preset, today, 1)).toEqual(expected);
  });

  it("uses custom bounds, swapping them when reversed", () => {
    expect(resolveRange("custom", today, 1, { from: "2026-01-05", to: "2026-02-01" })).toEqual({
      from: "2026-01-05",
      to: "2026-02-01",
    });
    expect(resolveRange("custom", today, 1, { from: "2026-02-01", to: "2026-01-05" })).toEqual({
      from: "2026-01-05",
      to: "2026-02-01",
    });
    expect(resolveRange("custom", today, 1, { from: "2026-01-05" })).toEqual({ from: "2026-10-01", to: "2026-10-31" });
  });

  it("respects a Sunday week start", () => {
    expect(resolveRange("this-week", today, 0)).toEqual({ from: "2026-10-11", to: "2026-10-17" });
  });
});

describe("matchesText", () => {
  it("is case- and accent-insensitive", () => {
    expect(matchesText(["Café Lidl"], "cafe")).toBe(true);
    expect(matchesText(["Хранителни стоки"], "хранителни")).toBe(true);
    expect(matchesText([null, "Groceries"], "GROC")).toBe(true);
    expect(matchesText(["Rent"], "gym")).toBe(false);
    expect(matchesText(["anything"], "   ")).toBe(true);
  });
});

const activity = (id: string, patch: Partial<Activity>): Activity => ({
  id,
  categoryId: "work",
  title: id,
  notes: null,
  startAt: "",
  endAt: "",
  startMs: 0,
  endMs: 1,
  status: "completed",
  createdAt: "",
  updatedAt: "",
  ...patch,
});

const transaction = (id: string, patch: Partial<Transaction>): Transaction => ({
  id,
  type: "expense",
  amountMinor: 100,
  currency: "EUR",
  occurredOn: "2026-10-14",
  categoryId: "groceries",
  description: null,
  createdAt: "",
  updatedAt: "",
  ...patch,
});

describe("filterActivities", () => {
  const items = [
    activity("Deep work", { notes: "API design" }),
    activity("Gym", { categoryId: "training", status: "scheduled" }),
    activity("Reading", { categoryId: "study" }),
  ];
  const names: Record<string, string> = { work: "Work", training: "Training", study: "Study" };

  it("combines category, status and text filters", () => {
    expect(filterActivities(items, { categoryId: "training" }).map((a) => a.id)).toEqual(["Gym"]);
    expect(filterActivities(items, { status: "completed" }).map((a) => a.id)).toEqual(["Deep work", "Reading"]);
    expect(filterActivities(items, { query: "api" }).map((a) => a.id)).toEqual(["Deep work"]);
    expect(filterActivities(items, { query: "study" }, (id) => names[id]).map((a) => a.id)).toEqual(["Reading"]);
    expect(filterActivities(items, {})).toHaveLength(3);
  });
});

describe("filterTransactions", () => {
  const items = [
    transaction("t1", { description: "Lidl" }),
    transaction("t2", { type: "income", categoryId: "salary", description: "October pay" }),
    transaction("t3", { currency: "BGN", description: "Pharmacy" }),
  ];

  it("filters by type, currency, category and text", () => {
    expect(filterTransactions(items, { type: "income" }).map((t) => t.id)).toEqual(["t2"]);
    expect(filterTransactions(items, { currency: "BGN" }).map((t) => t.id)).toEqual(["t3"]);
    expect(filterTransactions(items, { categoryId: "groceries" }).map((t) => t.id)).toEqual(["t1", "t3"]);
    expect(filterTransactions(items, { query: "lidl" }).map((t) => t.id)).toEqual(["t1"]);
  });
});

describe("groupByDate", () => {
  const items = [
    { date: "2026-10-14", at: 3 },
    { date: "2026-10-12", at: 1 },
    { date: "2026-10-14", at: 1 },
  ];

  it("orders days newest first with chronological items inside each day", () => {
    const groups = groupByDate(items, (item) => item.date, (item) => item.at, "newest");
    expect(groups.map((group) => [group.date, group.items.map((item) => item.at)])).toEqual([
      ["2026-10-14", [1, 3]],
      ["2026-10-12", [1]],
    ]);
  });

  it("can order days oldest first", () => {
    expect(groupByDate(items, (item) => item.date, (item) => item.at, "oldest")[0].date).toBe("2026-10-12");
  });
});

describe("monthsInRange", () => {
  it("lists the first day of every month in the range", () => {
    expect(monthsInRange("2026-11-15", "2027-01-02")).toEqual(["2026-11-01", "2026-12-01", "2027-01-01"]);
  });
});

describe("limitGroups", () => {
  const groups = [
    { date: "2026-10-14", items: [1, 2, 3] },
    { date: "2026-10-13", items: [4, 5] },
    { date: "2026-10-12", items: [6] },
  ];

  it("keeps whole days until the limit is reached", () => {
    expect(limitGroups(groups, 3).map((group) => group.date)).toEqual(["2026-10-14"]);
    expect(limitGroups(groups, 4).map((group) => group.date)).toEqual(["2026-10-14", "2026-10-13"]);
    expect(limitGroups(groups, 100)).toHaveLength(3);
    expect(limitGroups(groups, 0)).toEqual([]);
  });
});
