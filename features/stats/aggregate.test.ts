import { describe, expect, it } from "vitest";
import { buildDayIndex } from "@/features/calendar/day-index";
import { eachDay } from "@/lib/dates";
import type { Activity } from "@/lib/types";
import { activityTotals, chooseGranularity, minutesByBucket, minutesByCategory } from "./aggregate";

function activity(id: string, categoryId: string, start: string, end: string): Activity {
  return {
    id,
    categoryId,
    title: id,
    notes: null,
    startAt: start,
    endAt: end,
    startMs: Date.parse(start),
    endMs: Date.parse(end),
    status: "completed",
    createdAt: "",
    updatedAt: "",
  };
}

const activities = [
  // UTC zone keeps the arithmetic obvious.
  activity("run", "training", "2026-10-05T06:00:00Z", "2026-10-05T07:00:00Z"),
  activity("work", "work", "2026-10-05T09:00:00Z", "2026-10-05T17:00:00Z"),
  activity("sleep", "sleep", "2026-10-11T22:00:00Z", "2026-10-12T06:00:00Z"), // crosses into the next week
  activity("study", "study", "2026-10-20T18:00:00Z", "2026-10-20T19:30:00Z"),
];

describe("chooseGranularity", () => {
  it("picks day, week or month by range length", () => {
    expect(chooseGranularity("2026-10-01", "2026-10-31")).toBe("day");
    expect(chooseGranularity("2026-08-01", "2026-10-31")).toBe("week");
    expect(chooseGranularity("2026-01-01", "2026-12-31")).toBe("month");
  });
});

describe("activity statistics", () => {
  const days = eachDay("2026-10-01", "2026-10-31");
  const index = buildDayIndex(days, activities, [], "UTC");

  it("totals tracked time, distinct activities and active days", () => {
    expect(activityTotals(index.values())).toEqual({ minutes: 60 + 480 + 480 + 90, activities: 4, activeDays: 4 });
    expect(activityTotals(index.values(), "sleep")).toEqual({ minutes: 480, activities: 1, activeDays: 2 });
  });

  it("clips activities to the selected range", () => {
    const partial = buildDayIndex(eachDay("2026-10-12", "2026-10-31"), activities, [], "UTC");
    // Only the 6 hours of sleep after midnight on the 12th fall inside the range.
    expect(activityTotals(partial.values(), "sleep").minutes).toBe(360);
  });

  it("ranks time by category with shares", () => {
    const ranked = minutesByCategory(index.values());
    expect(ranked.map((entry) => entry.categoryId)).toEqual(["sleep", "work", "study", "training"]);
    expect(ranked[0].share).toBeCloseTo(480 / 1110);
  });

  it("splits time across week buckets at midnight", () => {
    const buckets = minutesByBucket(index, "2026-10-01", "2026-10-31", "week", 1);
    const byStart = Object.fromEntries(buckets.map((bucket) => [bucket.key, bucket.minutes]));
    expect(byStart["2026-10-05"]).toBe(60 + 480 + 120); // sleep 22:00-24:00 on Sunday the 11th
    expect(byStart["2026-10-12"]).toBe(360); // sleep 00:00-06:00 on Monday the 12th
    expect(byStart["2026-10-19"]).toBe(90);
    expect(buckets.reduce((sum, bucket) => sum + bucket.minutes, 0)).toBe(1110);
  });

  it("filters buckets by category", () => {
    const buckets = minutesByBucket(index, "2026-10-01", "2026-10-31", "month", 1, "work");
    expect(buckets).toEqual([{ key: "2026-10-01", label: expect.any(String), minutes: 480 }]);
  });
});
