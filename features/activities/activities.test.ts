import { describe, expect, it } from "vitest";
import { findOverlaps, rangesOverlap } from "./overlap";
import {
  activityFormSchema,
  createActivityInputSchema,
  updateActivityInputSchema,
  type ActivityFormValues,
} from "./schema";

const H = 3_600_000;
const at = (hour: number) => Date.parse("2026-10-14T00:00:00Z") + hour * H;
const item = (id: string, start: number, end: number) => ({ id, startMs: at(start), endMs: at(end) });

describe("overlap detection", () => {
  it("detects overlapping ranges", () => {
    expect(rangesOverlap(item("a", 8, 10), item("b", 9, 11))).toBe(true);
    expect(rangesOverlap(item("a", 8, 12), item("b", 9, 10))).toBe(true); // containment
    expect(rangesOverlap(item("a", 8, 10), item("b", 8, 10))).toBe(true); // identical
  });

  it("treats back-to-back activities as not overlapping", () => {
    expect(rangesOverlap(item("a", 8, 9), item("b", 9, 10))).toBe(false);
    expect(rangesOverlap(item("a", 9, 10), item("b", 8, 9))).toBe(false);
  });

  it("finds overlaps sorted by start, excluding the activity being edited", () => {
    const existing = [item("late", 11, 13), item("self", 9, 10), item("early", 7, 9.5), item("apart", 14, 15)];
    const overlaps = findOverlaps({ id: "self", startMs: at(9), endMs: at(12) }, existing);
    expect(overlaps.map((o) => o.id)).toEqual(["early", "late"]);
  });

  it("handles activities crossing midnight", () => {
    const sleep = item("sleep", 23, 31); // 23:00 -> 07:00 next day
    expect(findOverlaps({ startMs: at(30), endMs: at(32) }, [sleep]).map((o) => o.id)).toEqual(["sleep"]);
  });
});

describe("activity form validation", () => {
  const base: ActivityFormValues = {
    title: "  Morning run  ",
    categoryId: "6f1d1f4e-8f2a-4b7e-9a51-2c1d3e4f5a6b",
    startDate: "2026-10-14",
    startTime: "07:00",
    endDate: "2026-10-14",
    endTime: "08:15",
    status: "completed",
    notes: "  ",
  };
  const sofia = activityFormSchema("Europe/Sofia");

  it("converts local wall-clock fields to UTC instants in the profile time zone", () => {
    const result = sofia.safeParse(base);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      title: "Morning run",
      startAt: "2026-10-14T04:00:00.000Z",
      endAt: "2026-10-14T05:15:00.000Z",
      notes: null,
    });
  });

  it("supports activities that end the next day", () => {
    const result = sofia.safeParse({ ...base, startTime: "23:00", endDate: "2026-10-15", endTime: "07:00" });
    expect(result.success && result.data.endMs - result.data.startMs).toBe(8 * H);
  });

  it("measures real elapsed time across a DST change", () => {
    // Clocks go back one hour in Sofia on 2026-10-25: 00:00 -> 06:00 is 7 real hours.
    const result = sofia.safeParse({
      ...base,
      startDate: "2026-10-25",
      startTime: "00:00",
      endDate: "2026-10-25",
      endTime: "06:00",
    });
    expect(result.success && result.data.endMs - result.data.startMs).toBe(7 * H);
  });

  it.each([
    [{ title: "   " }, "title", "Enter a title"],
    [{ title: "x".repeat(121) }, "title", "Keep the title under 120 characters"],
    [{ categoryId: "" }, "categoryId", "Choose a category"],
    [{ startDate: "2026-02-30" }, "startDate", "Enter a valid start date"],
    [{ startTime: "25:00" }, "startTime", "Enter a valid start time"],
    [{ endTime: "07:00" }, "endTime", "End must be after the start"],
    [{ endTime: "06:59" }, "endTime", "End must be after the start"],
    [{ endDate: "2026-10-15", endTime: "07:01" }, "endTime", "An activity can last at most 24 hours"],
    [{ notes: "n".repeat(2001) }, "notes", "Notes can be at most 2000 characters"],
  ])("rejects %j", (patch, path, message) => {
    const result = sofia.safeParse({ ...base, ...patch });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(expect.objectContaining({ path: [path], message }));
  });

  it("accepts exactly 24 hours", () => {
    expect(sofia.safeParse({ ...base, endDate: "2026-10-15", endTime: "07:00" }).success).toBe(true);
  });
});

describe("server-side activity input", () => {
  const valid = {
    id: "0b7a4c1e-2d3f-4a5b-8c6d-7e8f9a0b1c2d",
    title: "Deep work",
    categoryId: "6f1d1f4e-8f2a-4b7e-9a51-2c1d3e4f5a6b",
    startAt: "2026-10-14T06:00:00.000Z",
    endAt: "2026-10-14T08:00:00+00:00",
    status: "completed" as const,
    notes: null,
    allowOverlap: false,
  };

  it("accepts a valid payload and normalizes notes", () => {
    const result = createActivityInputSchema.safeParse({ ...valid, notes: "  focus  " });
    expect(result.success && result.data.notes).toBe("focus");
  });

  it("rejects tampered payloads", () => {
    expect(createActivityInputSchema.safeParse({ ...valid, id: "not-a-uuid" }).success).toBe(false);
    expect(createActivityInputSchema.safeParse({ ...valid, status: "deleted" }).success).toBe(false);
    expect(createActivityInputSchema.safeParse({ ...valid, endAt: valid.startAt }).success).toBe(false);
    expect(createActivityInputSchema.safeParse({ ...valid, startAt: "yesterday" }).success).toBe(false);
    expect(createActivityInputSchema.safeParse({ ...valid, endAt: "2026-10-15T06:00:01Z" }).success).toBe(false);
  });

  it("requires the last-seen version for updates", () => {
    expect(updateActivityInputSchema.safeParse(valid).success).toBe(false);
    expect(
      updateActivityInputSchema.safeParse({ ...valid, expectedUpdatedAt: "2026-10-14T06:00:00.123456+00:00" }).success,
    ).toBe(true);
  });
});
