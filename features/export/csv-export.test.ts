import { describe, expect, it } from "vitest";
import type { Activity, ActivityCategory, FinanceCategory, Transaction } from "@/lib/types";
import { activitiesCsv, transactionsCsv } from "./csv-export";

const financeCategories = new Map<string, FinanceCategory>([
  ["c1", { id: "c1", kind: "expense", name: "Groceries", color: "#14b8a6", isArchived: false, sortOrder: 1, createdAt: "", updatedAt: "" }],
]);

const activityCategories = new Map<string, ActivityCategory>([
  ["a1", { id: "a1", name: "=Training", color: "#f97316", isArchived: false, sortOrder: 1, createdAt: "", updatedAt: "" }],
]);

function lines(csv: string): string[] {
  expect(csv.startsWith("﻿")).toBe(true);
  return csv.slice(1).trimEnd().split("\r\n");
}

describe("transactionsCsv", () => {
  it("writes exact decimal amounts and neutralizes formula-like text", () => {
    const transaction: Transaction = {
      id: "t1",
      type: "expense",
      amountMinor: 123_456,
      currency: "BGN",
      occurredOn: "2026-10-14",
      categoryId: "c1",
      description: '=HYPERLINK("http://evil.example","click")',
      createdAt: "2026-10-14T10:00:00.000000+00:00",
      updatedAt: "2026-10-14T10:00:00.000000+00:00",
    };
    const [header, row] = lines(transactionsCsv([transaction], financeCategories));
    expect(header).toBe("date,type,amount,currency,category,description,id,created_at,updated_at");
    expect(row).toBe(
      `2026-10-14,expense,1234.56,BGN,Groceries,"'=HYPERLINK(""http://evil.example"",""click"")",t1,2026-10-14T10:00:00.000000+00:00,2026-10-14T10:00:00.000000+00:00`,
    );
  });

  it("sorts rows chronologically", () => {
    const base = { type: "income" as const, amountMinor: 1, currency: "EUR" as const, categoryId: "x", description: null, updatedAt: "" };
    const csv = transactionsCsv(
      [
        { ...base, id: "late", occurredOn: "2026-10-20", createdAt: "a" },
        { ...base, id: "early", occurredOn: "2026-10-01", createdAt: "b" },
      ],
      financeCategories,
    );
    expect(lines(csv).slice(1).map((line) => line.split(",")[6])).toEqual(["early", "late"]);
  });
});

describe("activitiesCsv", () => {
  it("includes local times in the profile time zone, UTC instants and duration", () => {
    const activity: Activity = {
      id: "act1",
      categoryId: "a1",
      title: "Sleep",
      notes: "+ good night",
      startAt: "2026-10-14T20:00:00Z",
      endAt: "2026-10-15T04:00:00Z",
      startMs: Date.parse("2026-10-14T20:00:00Z"),
      endMs: Date.parse("2026-10-15T04:00:00Z"),
      status: "completed",
      createdAt: "c",
      updatedAt: "u",
    };
    const [, row] = lines(activitiesCsv([activity], activityCategories, "Europe/Sofia"));
    expect(row).toBe(
      "2026-10-14,2026-10-14 23:00,2026-10-15 07:00,Europe/Sofia,480,Sleep,'=Training,completed,'+ good night,2026-10-14T20:00:00.000Z,2026-10-15T04:00:00.000Z,act1,c,u",
    );
  });
});
