/**
 * CSV generation (RFC 4180) with protection against spreadsheet formula injection.
 *
 * Spreadsheet apps execute cells that start with =, +, -, @ (and tab/CR in some apps) as
 * formulas, so user-controlled text such as an activity title like `=HYPERLINK(...)` could
 * run when an export is opened. Text cells are therefore prefixed with a single quote when
 * they begin (after optional whitespace) with one of those characters, following OWASP's
 * guidance. Numeric cells produced by LifeOS itself are written verbatim.
 */

export type CsvCell = string | number | boolean | null | undefined;

/** A cell holding trusted, machine-generated numeric text (e.g. "-12.50"). */
export type CsvRawNumber = { readonly raw: string };

const FORMULA_TRIGGERS = new Set(["=", "+", "-", "@", "\t", "\r", "＝", "＋", "－", "＠"]);

/** Neutralizes text that a spreadsheet would interpret as a formula. */
export function neutralizeFormula(value: string): string {
  const firstNonSpace = value.trimStart().charAt(0);
  const first = value.charAt(0);
  if (FORMULA_TRIGGERS.has(first) || FORMULA_TRIGGERS.has(firstNonSpace)) {
    return `'${value}`;
  }
  return value;
}

function quote(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function csvNumber(raw: string): CsvRawNumber {
  if (!/^-?\d+(\.\d+)?$/.test(raw)) throw new Error(`Not a plain number: ${raw}`);
  return { raw };
}

function encodeCell(cell: CsvCell | CsvRawNumber): string {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "object") return cell.raw;
  if (typeof cell === "number") {
    if (!Number.isFinite(cell)) return "";
    return String(cell);
  }
  if (typeof cell === "boolean") return cell ? "true" : "false";
  return quote(neutralizeFormula(cell));
}

/**
 * Builds a CSV document. Starts with a UTF-8 byte-order mark so Excel detects the encoding
 * (category names and notes may contain Cyrillic or other non-ASCII text).
 */
export function toCsv(header: readonly string[], rows: ReadonlyArray<ReadonlyArray<CsvCell | CsvRawNumber>>): string {
  const lines = [header.map((title) => quote(neutralizeFormula(title))).join(",")];
  for (const row of rows) {
    if (row.length !== header.length) {
      throw new Error(`CSV row has ${row.length} cells, expected ${header.length}`);
    }
    lines.push(row.map(encodeCell).join(","));
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}
