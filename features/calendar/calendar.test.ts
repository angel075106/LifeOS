import { describe, expect, it } from "vitest";
import { eachDay } from "@/lib/dates";
import type { Activity, Transaction } from "@/lib/types";
import { buildDayIndex, segmentActivity } from "./day-index";
import { layoutDaySegments, MIN_VISUAL_MINUTES } from "./time-grid-layout";

const SOFIA = "Europe/Sofia";

function activity(id: string, startIso: string, endIso: string, title = id): Activity {
  return {
    id,
    categoryId: "cat",
    title,
    notes: null,
    startAt: startIso,
    endAt: endIso,
    startMs: Date.parse(startIso),
    endMs: Date.parse(endIso),
    status: "completed",
    createdAt: "",
    updatedAt: "",
  };
}

function transaction(id: string, occurredOn: string, type: "income" | "expense", amountMinor: number): Transaction {
  return {
    id,
    type,
    amountMinor,
    currency: "EUR",
    occurredOn,
    categoryId: "cat",
    description: null,
    createdAt: `${occurredOn}T12:00:00Z`,
    updatedAt: "",
  };
}

describe("segmentActivity", () => {
  it("keeps a same-day activity whole, positioned by local wall-clock time", () => {
    // 07:00-08:30 Sofia summer time (UTC+3)
    const [segment, ...rest] = segmentActivity(activity("run", "2026-10-14T04:00:00Z", "2026-10-14T05:30:00Z"), SOFIA);
    expect(rest).toEqual([]);
    expect(segment).toMatchObject({
      date: "2026-10-14",
      startMinute: 7 * 60,
      endMinute: 8 * 60 + 30,
      continuesBefore: false,
      continuesAfter: false,
    });
  });

  it("splits activities that cross local midnight", () => {
    // Sleep 23:00 -> 07:00 Sofia time
    const segments = segmentActivity(activity("sleep", "2026-10-14T20:00:00Z", "2026-10-15T04:00:00Z"), SOFIA);
    expect(segments.map((s) => [s.date, s.startMinute, s.endMinute, s.continuesBefore, s.continuesAfter])).toEqual([
      ["2026-10-14", 23 * 60, 1440, false, true],
      ["2026-10-15", 0, 7 * 60, true, false],
    ]);
  });

  it("does not spill onto the next day when ending exactly at midnight", () => {
    const segments = segmentActivity(activity("late", "2026-10-14T19:00:00Z", "2026-10-14T21:00:00Z"), SOFIA);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ date: "2026-10-14", startMinute: 22 * 60, endMinute: 1440, continuesAfter: false });
  });

  it("places the same instant on different days depending on the time zone", () => {
    const late = activity("call", "2026-10-14T22:30:00Z", "2026-10-14T23:00:00Z");
    expect(segmentActivity(late, "UTC")[0].date).toBe("2026-10-14");
    expect(segmentActivity(late, SOFIA)[0].date).toBe("2026-10-15");
  });
});

describe("buildDayIndex", () => {
  const days = eachDay("2026-10-14", "2026-10-15");

  it("aggregates tracked minutes per day using clipped, real elapsed time", () => {
    const index = buildDayIndex(
      days,
      [
        activity("sleep", "2026-10-14T20:00:00Z", "2026-10-15T04:00:00Z"), // 1h on 14th, 7h on 15th
        activity("work", "2026-10-15T06:00:00Z", "2026-10-15T10:00:00Z"), // 4h on 15th
      ],
      [],
      SOFIA,
    );
    expect(index.get("2026-10-14")?.activityMinutes).toBe(60);
    expect(index.get("2026-10-15")?.activityMinutes).toBe(11 * 60);
    expect(index.get("2026-10-15")?.segments.map((s) => s.activity.id)).toEqual(["sleep", "work"]);
  });

  it("counts a full 25-hour DST day correctly", () => {
    // 00:00 Oct 25 -> 00:00 Oct 26 Sofia is 25 real hours; split into two activities <= 24h.
    const index = buildDayIndex(
      ["2026-10-25"],
      [
        activity("a", "2026-10-24T21:00:00Z", "2026-10-25T09:00:00Z"),
        activity("b", "2026-10-25T09:00:00Z", "2026-10-25T22:00:00Z"),
      ],
      [],
      SOFIA,
    );
    expect(index.get("2026-10-25")?.activityMinutes).toBe(25 * 60);
  });

  it("attaches transactions to their calendar date with per-currency cash flow", () => {
    const index = buildDayIndex(
      days,
      [],
      [
        transaction("pay", "2026-10-15", "income", 150_000),
        transaction("lunch", "2026-10-15", "expense", 1_250),
        transaction("other", "2026-10-20", "expense", 999), // outside the visible days
      ],
      SOFIA,
    );
    expect(index.get("2026-10-14")?.transactions).toEqual([]);
    expect(index.get("2026-10-15")?.cashFlow).toEqual({
      EUR: { income: 150_000, expense: 1_250, net: 148_750, count: 2 },
    });
    expect(index.has("2026-10-20")).toBe(false);
  });

  it("handles many records on one day", () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      activity(`a${i}`, `2026-10-14T${String(5 + (i % 12)).padStart(2, "0")}:00:00Z`, `2026-10-14T${String(5 + (i % 12)).padStart(2, "0")}:30:00Z`),
    );
    const index = buildDayIndex(["2026-10-14"], many, [], SOFIA);
    expect(index.get("2026-10-14")?.segments).toHaveLength(60);
    expect(index.get("2026-10-14")?.activityMinutes).toBe(60 * 30);
  });
});

describe("layoutDaySegments", () => {
  const seg = (id: string, start: number, end: number) =>
    segmentActivity(
      activity(id, new Date(Date.UTC(2026, 9, 14, 0, start)).toISOString(), new Date(Date.UTC(2026, 9, 14, 0, end)).toISOString()),
      "UTC",
    )[0];

  it("gives non-overlapping segments the full width", () => {
    const layout = layoutDaySegments([seg("a", 60, 120), seg("b", 120, 180)]);
    expect(layout.map((s) => [s.activity.id, s.column, s.columns])).toEqual([
      ["a", 0, 1],
      ["b", 0, 1],
    ]);
  });

  it("places overlapping segments in side-by-side columns", () => {
    const layout = layoutDaySegments([seg("a", 60, 180), seg("b", 90, 150), seg("c", 160, 200), seg("d", 300, 360)]);
    const byId = Object.fromEntries(layout.map((s) => [s.activity.id, [s.column, s.columns]]));
    expect(byId).toEqual({ a: [0, 2], b: [1, 2], c: [1, 2], d: [0, 1] });
  });

  it("gives very short segments a minimum visual height for overlap purposes", () => {
    const layout = layoutDaySegments([seg("tiny", 60, 61), seg("next", 61 + MIN_VISUAL_MINUTES - 5, 120)]);
    expect(layout.every((s) => s.columns === 2)).toBe(true);
  });
});
