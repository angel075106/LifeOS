import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  dateRangeInstants,
  dayOfWeek,
  dayRangeInstants,
  diffInDays,
  eachDay,
  endOfMonth,
  formatClockTime,
  formatDuration,
  formatDurationLong,
  formatLocalDate,
  formatLocalDateRange,
  isValidLocalDate,
  isValidTimeZone,
  localDateOfInstant,
  minutesOfDayInZone,
  monthGridWeeks,
  overlapMs,
  parseTimeOfDay,
  startOfDayInstant,
  startOfWeek,
  timeZoneOffsetMs,
  todayInZone,
  weekDays,
  zonedTimeToInstant,
} from "./dates";

const iso = (ms: number) => new Date(ms).toISOString();
const HOUR = 3_600_000;

describe("LocalDate arithmetic", () => {
  it("validates calendar dates", () => {
    expect(isValidLocalDate("2026-10-14")).toBe(true);
    expect(isValidLocalDate("2028-02-29")).toBe(true);
    expect(isValidLocalDate("2026-02-29")).toBe(false);
    expect(isValidLocalDate("2026-13-01")).toBe(false);
    expect(isValidLocalDate("2026-04-31")).toBe(false);
    expect(isValidLocalDate("2026-1-1")).toBe(false);
    expect(isValidLocalDate("not a date")).toBe(false);
    expect(isValidLocalDate(20261014)).toBe(false);
  });

  it("adds days across month, year and leap boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(diffInDays("2027-01-01", "2026-12-25")).toBe(7);
  });

  it("is unaffected by DST because it never uses clock time", () => {
    // 2026-03-29 and 2026-10-25 are DST changes in Europe.
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(addDays("2026-10-25", 1)).toBe("2026-10-26");
  });

  it("knows the day of the week", () => {
    expect(dayOfWeek("2026-10-14")).toBe(3); // Wednesday
    expect(dayOfWeek("1970-01-01")).toBe(4); // Thursday
    expect(dayOfWeek("1969-12-31")).toBe(3);
  });

  it("finds the start of the week for Monday and Sunday starts", () => {
    expect(startOfWeek("2026-10-14", 1)).toBe("2026-10-12");
    expect(startOfWeek("2026-10-14", 0)).toBe("2026-10-11");
    expect(startOfWeek("2026-10-12", 1)).toBe("2026-10-12");
    expect(startOfWeek("2026-10-18", 1)).toBe("2026-10-12");
    expect(weekDays("2026-10-14", 1)).toEqual(eachDay("2026-10-12", "2026-10-18"));
  });

  it("adds months with day clamping", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-10-14", -10)).toBe("2025-12-14");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(endOfMonth("2026-02-10")).toBe("2026-02-28");
  });

  it("builds month grids that cover the whole month", () => {
    const october = monthGridWeeks("2026-10-14", 1);
    expect(october).toHaveLength(5);
    expect(october[0][0]).toBe("2026-09-28");
    expect(october.at(-1)?.at(-1)).toBe("2026-11-01");
    for (const week of october) expect(week).toHaveLength(7);

    // February 2027 starts on a Monday and has exactly four weeks.
    expect(monthGridWeeks("2027-02-01", 1)).toHaveLength(4);
    // August 2026 needs six rows when weeks start on Monday.
    expect(monthGridWeeks("2026-08-01", 1)).toHaveLength(6);
    // Sunday-start grid begins on a Sunday.
    expect(dayOfWeek(monthGridWeeks("2026-10-01", 0)[0][0])).toBe(0);
  });

  it("parses times of day", () => {
    expect(parseTimeOfDay("00:00")).toBe(0);
    expect(parseTimeOfDay("23:59")).toBe(1439);
    expect(parseTimeOfDay("24:00")).toBeNull();
    expect(parseTimeOfDay("7:30")).toBeNull();
    expect(parseTimeOfDay("12:60")).toBeNull();
  });
});

describe("time zone conversion", () => {
  it("validates IANA time zones", () => {
    expect(isValidTimeZone("Europe/Sofia")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });

  it("converts ordinary wall times in Sofia (summer and winter)", () => {
    expect(iso(zonedTimeToInstant("2026-07-01", 8 * 60, "Europe/Sofia"))).toBe("2026-07-01T05:00:00.000Z");
    expect(iso(zonedTimeToInstant("2026-12-01", 8 * 60, "Europe/Sofia"))).toBe("2026-12-01T06:00:00.000Z");
  });

  it("moves non-existent spring-forward times forward by the gap", () => {
    // Sofia jumps 03:00 -> 04:00 on 2026-03-29.
    expect(iso(zonedTimeToInstant("2026-03-29", 2 * 60 + 30, "Europe/Sofia"))).toBe("2026-03-29T00:30:00.000Z");
    expect(iso(zonedTimeToInstant("2026-03-29", 3 * 60 + 30, "Europe/Sofia"))).toBe("2026-03-29T01:30:00.000Z");
    expect(iso(zonedTimeToInstant("2026-03-29", 4 * 60, "Europe/Sofia"))).toBe("2026-03-29T01:00:00.000Z");
    // New York jumps 02:00 -> 03:00 on 2026-03-08.
    expect(iso(zonedTimeToInstant("2026-03-08", 2 * 60 + 30, "America/New_York"))).toBe(
      "2026-03-08T07:30:00.000Z",
    );
  });

  it("resolves ambiguous fall-back times to the earlier instant", () => {
    // Sofia repeats 03:00-04:00 on 2026-10-25.
    expect(iso(zonedTimeToInstant("2026-10-25", 3 * 60 + 30, "Europe/Sofia"))).toBe("2026-10-25T00:30:00.000Z");
    expect(iso(zonedTimeToInstant("2026-10-25", 4 * 60 + 30, "Europe/Sofia"))).toBe("2026-10-25T02:30:00.000Z");
    // New York repeats 01:00-02:00 on 2026-11-01.
    expect(iso(zonedTimeToInstant("2026-11-01", 90, "America/New_York"))).toBe("2026-11-01T05:30:00.000Z");
  });

  it("handles fractional offsets", () => {
    expect(iso(zonedTimeToInstant("2026-10-14", 9 * 60, "Asia/Kolkata"))).toBe("2026-10-14T03:30:00.000Z");
    expect(iso(zonedTimeToInstant("2026-10-14", 9 * 60, "Asia/Kathmandu"))).toBe("2026-10-14T03:15:00.000Z");
    expect(timeZoneOffsetMs(Date.parse("2026-10-14T00:00:00Z"), "Asia/Kathmandu")).toBe(5.75 * HOUR);
  });

  it("computes day lengths of 23, 24 and 25 hours", () => {
    const length = (date: string, zone: string) => {
      const { start, end } = dayRangeInstants(date, zone);
      return (end - start) / HOUR;
    };
    expect(length("2026-03-29", "Europe/Sofia")).toBe(23);
    expect(length("2026-10-14", "Europe/Sofia")).toBe(24);
    expect(length("2026-10-25", "Europe/Sofia")).toBe(25);
    expect(length("2026-10-25", "UTC")).toBe(24);
  });

  it("maps instants back to local dates and clock times", () => {
    const instant = Date.parse("2026-10-14T22:30:00Z");
    expect(localDateOfInstant(instant, "UTC")).toBe("2026-10-14");
    expect(localDateOfInstant(instant, "Europe/Sofia")).toBe("2026-10-15");
    expect(localDateOfInstant(instant, "America/Los_Angeles")).toBe("2026-10-14");
    expect(formatClockTime(instant, "Europe/Sofia")).toBe("01:30");
    expect(minutesOfDayInZone(instant, "Europe/Sofia")).toBe(90);
    expect(todayInZone("Pacific/Kiritimati", instant)).toBe("2026-10-15");
  });

  it("keeps day boundaries consistent for many zones and dates (invariants)", () => {
    const zones = [
      "UTC",
      "Europe/Sofia",
      "Europe/London",
      "America/New_York",
      "America/Sao_Paulo",
      "America/Havana",
      "Asia/Tokyo",
      "Asia/Kolkata",
      "Australia/Lord_Howe",
      "Pacific/Chatham",
      "Pacific/Kiritimati",
    ];
    const dates = eachDay("2026-01-01", "2026-12-31").filter((_, index) => index % 3 === 0);
    dates.push("2026-03-08", "2026-03-29", "2026-10-04", "2026-10-25", "2026-11-01");
    for (const zone of zones) {
      for (const date of dates) {
        const start = startOfDayInstant(date, zone);
        expect(localDateOfInstant(start, zone), `${zone} ${date}`).toBe(date);
        expect(localDateOfInstant(start - 1, zone), `${zone} ${date} minus 1ms`).toBe(addDays(date, -1));
        const { end } = dayRangeInstants(date, zone);
        const hours = (end - start) / HOUR;
        expect(hours, `${zone} ${date} length`).toBeGreaterThanOrEqual(23);
        expect(hours, `${zone} ${date} length`).toBeLessThanOrEqual(25);
      }
    }
  });

  it("builds multi-day ranges from day boundaries", () => {
    const { start, end } = dateRangeInstants("2026-10-01", "2026-10-31", "Europe/Sofia");
    expect(iso(start)).toBe("2026-09-30T21:00:00.000Z");
    // October 2026 in Sofia has one 25-hour day.
    expect((end - start) / HOUR).toBe(31 * 24 + 1);
  });
});

describe("overlapMs", () => {
  it("measures the overlap of half-open ranges", () => {
    expect(overlapMs(0, 10, 5, 20)).toBe(5);
    expect(overlapMs(0, 10, 10, 20)).toBe(0);
    expect(overlapMs(5, 6, 0, 100)).toBe(1);
    expect(overlapMs(20, 30, 0, 10)).toBe(0);
  });
});

describe("formatting", () => {
  it("formats calendar dates without shifting the day", () => {
    expect(formatLocalDate("2026-10-14", { weekday: "long", day: "numeric", month: "long" })).toBe(
      "Wednesday 14 October",
    );
    expect(formatLocalDate("2026-10-01", { month: "long", year: "numeric" })).toBe("October 2026");
  });

  it("formats date ranges compactly", () => {
    expect(
      formatLocalDateRange("2026-10-12", "2026-10-18", { day: "numeric", month: "short", year: "numeric" }),
    ).toMatch(/^12\s?[–-]\s?18 Oct 2026$/);
  });

  it("formats durations", () => {
    expect(formatDuration(0)).toBe("0m");
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(120)).toBe("2h");
    expect(formatDuration(260)).toBe("4h 20m");
    expect(formatDurationLong(61)).toBe("1 hour 1 minute");
    expect(formatDurationLong(0)).toBe("0 minutes");
    expect(formatDurationLong(180)).toBe("3 hours");
  });
});
