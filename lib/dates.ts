/**
 * Date and time-zone utilities.
 *
 * Strategy
 *   - A calendar day is a `LocalDate` string ("YYYY-MM-DD"). Day arithmetic on LocalDates is
 *     pure integer math and never depends on the machine's time zone.
 *   - An absolute moment is an epoch-millisecond number (or ISO string from the database).
 *   - Converting between the two always takes an explicit IANA time zone (the user's
 *     profile setting), via Intl. Nothing here reads the host's local time zone.
 *   - Wall-clock times that do not exist (spring-forward gap) resolve forward by the gap;
 *     ambiguous times (fall-back overlap) resolve to the earlier instant.
 */

export type LocalDate = string;

export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;
export const MINUTES_PER_DAY = 1440;

/** Locale used for all user-facing formatting (24-hour clock, day-month order). */
export const APP_LOCALE = "en-GB";

const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_OF_DAY_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

// ---------------------------------------------------------------------------
// LocalDate arithmetic
// ---------------------------------------------------------------------------

/** Epoch ms of a UTC wall time. Unlike Date.UTC, years 0-99 are not mapped to 19xx. */
function utcMs(year: number, month: number, day: number, minutes = 0, seconds = 0): number {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getTime() + minutes * MS_PER_MINUTE + seconds * 1000;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(utcMs(year, month + 1, 0)).getUTCDate();
}

export function isValidLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== "string") return false;
  const match = LOCAL_DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

export function parseLocalDate(value: LocalDate): { year: number; month: number; day: number } {
  if (!isValidLocalDate(value)) throw new RangeError(`Invalid date: ${String(value)}`);
  return { year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)), day: Number(value.slice(8, 10)) };
}

export function toLocalDate(year: number, month: number, day: number): LocalDate {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Whole days since 1970-01-01 for a LocalDate. */
export function toDayNumber(date: LocalDate): number {
  const { year, month, day } = parseLocalDate(date);
  return Math.round(utcMs(year, month, day) / MS_PER_DAY);
}

export function fromDayNumber(dayNumber: number): LocalDate {
  const date = new Date(dayNumber * MS_PER_DAY);
  return toLocalDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromDayNumber(toDayNumber(date) + days);
}

/** Number of days from `b` to `a` (a - b). */
export function diffInDays(a: LocalDate, b: LocalDate): number {
  return toDayNumber(a) - toDayNumber(b);
}

/** 0 = Sunday ... 6 = Saturday. 1970-01-01 was a Thursday. */
export function dayOfWeek(date: LocalDate): number {
  return (((toDayNumber(date) + 4) % 7) + 7) % 7;
}

export type WeekStart = 0 | 1;

export function startOfWeek(date: LocalDate, weekStartsOn: WeekStart): LocalDate {
  const offset = (dayOfWeek(date) - weekStartsOn + 7) % 7;
  return addDays(date, -offset);
}

export function startOfMonth(date: LocalDate): LocalDate {
  const { year, month } = parseLocalDate(date);
  return toLocalDate(year, month, 1);
}

export function endOfMonth(date: LocalDate): LocalDate {
  const { year, month } = parseLocalDate(date);
  return toLocalDate(year, month, daysInMonth(year, month));
}

/** Adds calendar months, clamping the day (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(date: LocalDate, months: number): LocalDate {
  const { year, month, day } = parseLocalDate(date);
  const index = year * 12 + (month - 1) + months;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  return toLocalDate(nextYear, nextMonth, Math.min(day, daysInMonth(nextYear, nextMonth)));
}

/** Inclusive list of days from `start` to `end`. */
export function eachDay(start: LocalDate, end: LocalDate): LocalDate[] {
  const first = toDayNumber(start);
  const last = toDayNumber(end);
  const days: LocalDate[] = [];
  for (let n = first; n <= last; n += 1) days.push(fromDayNumber(n));
  return days;
}

export function weekDays(anchor: LocalDate, weekStartsOn: WeekStart): LocalDate[] {
  const start = startOfWeek(anchor, weekStartsOn);
  return eachDay(start, addDays(start, 6));
}

/**
 * Weeks (rows of 7 days) covering the month that contains `anchor`, starting on the
 * configured week start. Returns 4-6 rows depending on the month.
 */
export function monthGridWeeks(anchor: LocalDate, weekStartsOn: WeekStart): LocalDate[][] {
  const first = startOfWeek(startOfMonth(anchor), weekStartsOn);
  const lastOfMonth = endOfMonth(anchor);
  const weeks: LocalDate[][] = [];
  for (let weekStart = first; weekStart <= lastOfMonth; weekStart = addDays(weekStart, 7)) {
    weeks.push(eachDay(weekStart, addDays(weekStart, 6)));
  }
  return weeks;
}

export function isSameMonth(a: LocalDate, b: LocalDate): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

// ---------------------------------------------------------------------------
// Time of day
// ---------------------------------------------------------------------------

/** "HH:mm" -> minutes since midnight, or null when malformed. */
export function parseTimeOfDay(value: string): number | null {
  const match = TIME_OF_DAY_RE.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatTimeOfDay(minutes: number): string {
  const normalized = ((Math.floor(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Time zones
// ---------------------------------------------------------------------------

export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== "string" || timeZone.length === 0 || timeZone.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The device's IANA time zone (browser or server runtime), falling back to UTC. */
export function deviceTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(zone) ? zone : "UTC";
  } catch {
    return "UTC";
  }
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatters.set(timeZone, formatter);
  }
  return formatter;
}

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/** Wall-clock fields of an instant as seen in `timeZone`. */
export function zonedParts(instant: number, timeZone: string): ZonedParts {
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};
  for (const part of partsFormatter(timeZone).formatToParts(instant)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year ?? 1970,
    month: parts.month ?? 1,
    day: parts.day ?? 1,
    // Some engines report midnight as 24 even with h23; normalize defensively.
    hour: (parts.hour ?? 0) % 24,
    minute: parts.minute ?? 0,
    second: parts.second ?? 0,
  };
}

/** UTC offset of `timeZone` at `instant`, in milliseconds (e.g. +3h for EEST). */
export function timeZoneOffsetMs(instant: number, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const wallAsUtc = utcMs(p.year, p.month, p.day, p.hour * 60 + p.minute, p.second);
  return wallAsUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * Converts a wall-clock time (date + minutes after midnight) in `timeZone` to an instant.
 * `minutes` may exceed 1440 to express times on following days.
 */
export function zonedTimeToInstant(date: LocalDate, minutes: number, timeZone: string): number {
  const { year, month, day } = parseLocalDate(date);
  const wall = utcMs(year, month, day, minutes);
  const offsetBefore = timeZoneOffsetMs(wall - MS_PER_DAY, timeZone);
  const offsetAfter = timeZoneOffsetMs(wall + MS_PER_DAY, timeZone);

  const valid = [wall - offsetBefore, wall - offsetAfter].filter(
    (candidate) => timeZoneOffsetMs(candidate, timeZone) === wall - candidate,
  );
  if (valid.length > 0) return Math.min(...valid);
  // Non-existent local time: move forward by the length of the gap.
  return wall - offsetBefore;
}

export function startOfDayInstant(date: LocalDate, timeZone: string): number {
  return zonedTimeToInstant(date, 0, timeZone);
}

/** Half-open instant range [start, end) covering the local calendar day. */
export function dayRangeInstants(date: LocalDate, timeZone: string): { start: number; end: number } {
  return { start: startOfDayInstant(date, timeZone), end: startOfDayInstant(addDays(date, 1), timeZone) };
}

/** Half-open instant range covering local days `from` through `to` inclusive. */
export function dateRangeInstants(
  from: LocalDate,
  to: LocalDate,
  timeZone: string,
): { start: number; end: number } {
  return { start: startOfDayInstant(from, timeZone), end: startOfDayInstant(addDays(to, 1), timeZone) };
}

export function localDateOfInstant(instant: number, timeZone: string): LocalDate {
  const p = zonedParts(instant, timeZone);
  return toLocalDate(p.year, p.month, p.day);
}

/** Minutes after local midnight (wall clock) of an instant. */
export function minutesOfDayInZone(instant: number, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  return p.hour * 60 + p.minute + p.second / 60;
}

export function todayInZone(timeZone: string, now: number = Date.now()): LocalDate {
  return localDateOfInstant(now, timeZone);
}

/** Length of overlap between two half-open ranges, never negative. */
export function overlapMs(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function cachedFormatter(key: string, create: () => Intl.DateTimeFormat): Intl.DateTimeFormat {
  let formatter = dateFormatters.get(key);
  if (!formatter) {
    formatter = create();
    dateFormatters.set(key, formatter);
  }
  return formatter;
}

function localDateToUtcMidnight(date: LocalDate): number {
  const { year, month, day } = parseLocalDate(date);
  return utcMs(year, month, day);
}

/** Formats a calendar date (no time zone shifting can occur). */
export function formatLocalDate(date: LocalDate, options: Intl.DateTimeFormatOptions): string {
  const formatter = cachedFormatter(`date|${JSON.stringify(options)}`, () =>
    new Intl.DateTimeFormat(APP_LOCALE, { ...options, timeZone: "UTC" }),
  );
  return formatter.format(localDateToUtcMidnight(date));
}

/** Formats a range of calendar dates compactly, e.g. "12–18 Oct 2026". */
export function formatLocalDateRange(
  from: LocalDate,
  to: LocalDate,
  options: Intl.DateTimeFormatOptions,
): string {
  const formatter = cachedFormatter(`range|${JSON.stringify(options)}`, () =>
    new Intl.DateTimeFormat(APP_LOCALE, { ...options, timeZone: "UTC" }),
  );
  return formatter.formatRange(localDateToUtcMidnight(from), localDateToUtcMidnight(to));
}

/** Formats an instant's wall-clock time in `timeZone` as "HH:mm". */
export function formatClockTime(instant: number, timeZone: string): string {
  return formatTimeOfDay(Math.floor(minutesOfDayInZone(instant, timeZone)));
}

/** Formats an instant in `timeZone` with arbitrary Intl options. */
export function formatInstant(
  instant: number,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const formatter = cachedFormatter(`instant|${timeZone}|${JSON.stringify(options)}`, () =>
    new Intl.DateTimeFormat(APP_LOCALE, { ...options, timeZone }),
  );
  return formatter.format(instant);
}

/** Compact duration: "45m", "2h", "4h 20m". */
export function formatDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** Spoken duration for screen readers: "4 hours 20 minutes". */
export function formatDurationLong(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  if (rest > 0 || hours === 0) parts.push(`${rest} ${rest === 1 ? "minute" : "minutes"}`);
  return parts.join(" ");
}

/** "2026-10" style key for grouping by month. */
export function monthKey(date: LocalDate): string {
  return date.slice(0, 7);
}
