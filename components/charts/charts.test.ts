import { describe, expect, it } from "vitest";
import { hourTicks } from "./charts";

describe("hourTicks", () => {
  it("uses whole-hour steps with at most five intervals", () => {
    expect(hourTicks(0)).toEqual([0, 60]);
    expect(hourTicks(15 * 60 + 20)).toEqual([0, 4, 8, 12, 16].map((h) => h * 60));
    expect(hourTicks(45)).toEqual([0, 60]);
    expect(hourTicks(9 * 60)).toEqual([0, 2, 4, 6, 8, 10].map((h) => h * 60));
    const weekly = hourTicks(95 * 60);
    expect(weekly.every((tick) => tick % 60 === 0)).toBe(true);
    expect(weekly.length - 1).toBeLessThanOrEqual(5);
    expect(weekly.at(-1)).toBeGreaterThanOrEqual(95 * 60);
  });
});
