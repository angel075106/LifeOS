import { describe, expect, it } from "vitest";
import {
  formatMoney,
  MAX_AMOUNT_MINOR,
  minorToDecimalString,
  parseAmountToMinor,
  sumMinor,
} from "./money";

describe("parseAmountToMinor", () => {
  it.each([
    ["12", 1200],
    ["12.3", 1230],
    ["12.34", 1234],
    ["12,34", 1234],
    ["0.01", 1],
    ["0,10", 10],
    ["007.50", 750],
    ["1 234.56", 123456],
    ["1 234,56", 123456],
    ["  42  ", 4200],
    ["12.", 1200],
    ["99999999.99", MAX_AMOUNT_MINOR],
  ])("parses %j as %i minor units", (input, expected) => {
    expect(parseAmountToMinor(input, "EUR")).toEqual({ ok: true, minor: expected });
  });

  it("does not suffer from binary floating-point errors", () => {
    // 0.1 + 0.2 style inputs and values that are inexact in binary.
    expect(parseAmountToMinor("0.29", "EUR")).toEqual({ ok: true, minor: 29 });
    expect(parseAmountToMinor("1.15", "BGN")).toEqual({ ok: true, minor: 115 });
    expect(parseAmountToMinor("4.35", "EUR")).toEqual({ ok: true, minor: 435 });
    expect(parseAmountToMinor("1005.07", "EUR")).toEqual({ ok: true, minor: 100507 });
  });

  it.each([
    ["", "Enter an amount"],
    ["   ", "Enter an amount"],
    ["-5", "Enter the amount without a sign"],
    ["+5", "Enter the amount without a sign"],
    ["1.234", "Use at most 2 decimal places"],
    ["1,2,3", "Use digits and one decimal separator, like 12.34"],
    ["1.234,56", "Use digits and one decimal separator, like 12.34"],
    ["12abc", "Use digits and one decimal separator, like 12.34"],
    ["1e5", "Use digits and one decimal separator, like 12.34"],
    [".5", "Use digits and one decimal separator, like 12.34"],
    ["0", "Amount must be greater than zero"],
    ["0.00", "Amount must be greater than zero"],
    ["100000000", "Amount is too large"],
    ["123456789012345678901234567890", "Amount is too large"],
  ])("rejects %j", (input, error) => {
    expect(parseAmountToMinor(input, "EUR")).toEqual({ ok: false, error });
  });
});

describe("minorToDecimalString", () => {
  it.each([
    [0, "0.00"],
    [1, "0.01"],
    [10, "0.10"],
    [1234, "12.34"],
    [-5, "-0.05"],
    [-123456, "-1234.56"],
    [MAX_AMOUNT_MINOR, "99999999.99"],
  ])("formats %i as %s", (minor, expected) => {
    expect(minorToDecimalString(minor, "EUR")).toBe(expected);
  });

  it("round-trips with the parser", () => {
    for (const minor of [1, 9, 10, 99, 100, 101, 1999, 123456, 987654321]) {
      const parsed = parseAmountToMinor(minorToDecimalString(minor, "BGN"), "BGN");
      expect(parsed).toEqual({ ok: true, minor });
    }
  });

  it("rejects non-integers", () => {
    expect(() => minorToDecimalString(1.5, "EUR")).toThrow(RangeError);
  });
});

describe("formatMoney", () => {
  it("formats euros and leva with grouping", () => {
    expect(formatMoney(123456, "EUR")).toBe("€1,234.56");
    // Intl separates the ISO code with a no-break space so it never wraps.
    expect(formatMoney(500, "BGN")).toBe("BGN 5.00");
  });

  it("formats large values exactly", () => {
    expect(formatMoney(MAX_AMOUNT_MINOR, "EUR")).toBe("€99,999,999.99");
  });

  it("supports explicit signs for cash-flow display", () => {
    expect(formatMoney(1050, "EUR", { signDisplay: "always" })).toBe("+€10.50");
    expect(formatMoney(-1050, "EUR")).toBe("-€10.50");
    expect(formatMoney(0, "EUR", { signDisplay: "exceptZero" })).toBe("€0.00");
  });
});

describe("sumMinor", () => {
  it("adds integer minor units exactly", () => {
    expect(sumMinor([10, 20, 30])).toBe(60);
    expect(sumMinor([])).toBe(0);
    // 0.1 + 0.2 in cents
    expect(sumMinor([10, 20])).toBe(30);
  });

  it("refuses fractional or unsafe values", () => {
    expect(() => sumMinor([1, 0.5])).toThrow(RangeError);
    expect(() => sumMinor([Number.MAX_SAFE_INTEGER, 1])).toThrow(RangeError);
  });
});
