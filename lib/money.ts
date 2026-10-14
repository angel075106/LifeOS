/**
 * Money is represented everywhere as an integer number of minor units (cents) plus a
 * currency code. Conversions to and from text are done with string/integer arithmetic so no
 * floating-point value is ever the source of truth.
 */

export const CURRENCIES = ["EUR", "BGN"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = "EUR";

/** Digits after the decimal point for each supported currency. */
export const CURRENCY_DECIMALS: Record<Currency, number> = { EUR: 2, BGN: 2 };

/** Largest single amount accepted (99,999,999.99). Mirrors the database CHECK constraint. */
export const MAX_AMOUNT_MINOR = 9_999_999_999;

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
}

export type ParseAmountResult = { ok: true; minor: number } | { ok: false; error: string };

/**
 * Parses user input such as "12", "12.5", "12,50" or "1 234.56" into minor units.
 * Accepts one decimal separator ("." or ","), spaces as thousands separators, and at most
 * the currency's number of decimals. Signs are rejected: the transaction type carries the
 * direction.
 */
export function parseAmountToMinor(input: string, currency: Currency): ParseAmountResult {
  const decimals = CURRENCY_DECIMALS[currency];
  // Remove ordinary, no-break and thin spaces used as digit grouping.
  const compact = input.trim().replace(/[\s  ]/g, "");

  if (compact === "") return { ok: false, error: "Enter an amount" };
  if (/^[+-]/.test(compact)) return { ok: false, error: "Enter the amount without a sign" };

  const match = /^(\d+)(?:[.,](\d*))?$/.exec(compact);
  if (!match) return { ok: false, error: "Use digits and one decimal separator, like 12.34" };

  const [, wholePart, fractionPart = ""] = match;
  if (fractionPart.length > decimals) {
    return { ok: false, error: `Use at most ${decimals} decimal places` };
  }

  const whole = wholePart.replace(/^0+(?=\d)/, "");
  // Guard before converting so huge inputs never become imprecise numbers.
  if (whole.length > String(MAX_AMOUNT_MINOR).length) {
    return { ok: false, error: "Amount is too large" };
  }

  const minor = Number(whole + fractionPart.padEnd(decimals, "0"));
  if (!Number.isSafeInteger(minor) || minor > MAX_AMOUNT_MINOR) {
    return { ok: false, error: "Amount is too large" };
  }
  if (minor <= 0) return { ok: false, error: "Amount must be greater than zero" };
  return { ok: true, minor };
}

/** "1234" minor units -> "12.34" (exact, no grouping). Handles negative values. */
export function minorToDecimalString(minor: number, currency: Currency): string {
  assertSafeInteger(minor);
  const decimals = CURRENCY_DECIMALS[currency];
  const negative = minor < 0;
  const digits = String(Math.abs(minor)).padStart(decimals + 1, "0");
  const whole = digits.slice(0, digits.length - decimals);
  const fraction = digits.slice(digits.length - decimals);
  return `${negative ? "-" : ""}${whole}${decimals > 0 ? `.${fraction}` : ""}`;
}

const formatters = new Map<string, Intl.NumberFormat>();

function currencyFormatter(currency: Currency, signDisplay: Intl.NumberFormatOptions["signDisplay"]) {
  const key = `${currency}|${signDisplay}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      signDisplay,
      minimumFractionDigits: CURRENCY_DECIMALS[currency],
      maximumFractionDigits: CURRENCY_DECIMALS[currency],
    });
    formatters.set(key, formatter);
  }
  return formatter;
}

export type FormatMoneyOptions = {
  /** "auto" (default) shows "-" for negatives, "always"/"exceptZero" force a sign. */
  signDisplay?: "auto" | "always" | "exceptZero" | "never";
};

/**
 * Formats minor units for display, e.g. 123456 EUR -> "€1,234.56", 500 BGN -> "BGN 5.00".
 * The decimal string is passed to Intl as an exact decimal, so no float rounding occurs.
 */
export function formatMoney(minor: number, currency: Currency, options: FormatMoneyOptions = {}): string {
  const decimal = minorToDecimalString(minor, currency);
  // Intl.NumberFormat#format accepts numeric strings as exact decimals (ES2023).
  return currencyFormatter(currency, options.signDisplay ?? "auto").format(
    decimal as unknown as number,
  );
}

/** Sums integer minor units, refusing to silently lose precision. */
export function sumMinor(values: Iterable<number>): number {
  let total = 0;
  for (const value of values) {
    assertSafeInteger(value);
    total += value;
  }
  assertSafeInteger(total);
  return total;
}

function assertSafeInteger(value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Money values must be safe integers of minor units, got ${value}`);
  }
}
