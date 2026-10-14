import { afterAll, describe, expect, it } from "vitest";
import {
  dayRangeInstants,
  localDateOfInstant,
  monthGridWeeks,
  todayInZone,
  zonedTimeToInstant,
} from "./dates";

/**
 * LifeOS runs on servers (UTC) and on devices in any zone, so results must depend only on
 * the profile time zone passed in - never on the host's TZ. Node re-reads process.env.TZ
 * when it is assigned, which lets this test switch the host zone at runtime.
 */
const originalTz = process.env.TZ;

afterAll(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

function snapshot() {
  const instant = Date.parse("2026-10-25T00:45:00Z");
  return {
    hostOffset: new Date(instant).getTimezoneOffset(),
    sofiaMorning: zonedTimeToInstant("2026-10-25", 8 * 60, "Europe/Sofia"),
    ambiguous: zonedTimeToInstant("2026-10-25", 3 * 60 + 30, "Europe/Sofia"),
    tokyoDay: dayRangeInstants("2026-03-29", "Asia/Tokyo"),
    sofiaLongDay: dayRangeInstants("2026-10-25", "Europe/Sofia"),
    localDate: localDateOfInstant(instant, "America/New_York"),
    today: todayInZone("Europe/Sofia", instant),
    grid: monthGridWeeks("2026-10-14", 1).map((week) => week[0]),
  };
}

describe("host time zone independence", () => {
  it("produces identical results under very different host zones", () => {
    const results = ["UTC", "Pacific/Kiritimati", "America/Adak", "Europe/Sofia", "Asia/Kathmandu"].map((zone) => {
      process.env.TZ = zone;
      return snapshot();
    });

    // Sanity check: the host zone really changed between runs.
    expect(new Set(results.map((result) => result.hostOffset)).size).toBeGreaterThan(1);

    const withoutHost = results.map((result) => ({ ...result, hostOffset: 0 }));
    for (const result of withoutHost.slice(1)) {
      expect(result).toEqual(withoutHost[0]);
    }
  });
});
