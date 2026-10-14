import { describe, expect, it } from "vitest";
import { csvNumber, neutralizeFormula, toCsv } from "./csv";

describe("neutralizeFormula", () => {
  it.each([
    ["=1+1", "'=1+1"],
    ["+SUM(A1:A2)", "'+SUM(A1:A2)"],
    ["-2+3", "'-2+3"],
    ["@SUM(A1)", "'@SUM(A1)"],
    ["\t=1", "'\t=1"],
    ["\r=1", "'\r=1"],
    ['  =HYPERLINK("http://evil.example")', '\'  =HYPERLINK("http://evil.example")'],
    ["＝1+1", "'＝1+1"],
  ])("prefixes %j", (input, expected) => {
    expect(neutralizeFormula(input)).toBe(expected);
  });

  it.each(["Groceries", "Morning run", "12.50", "email@example.com", "Coffee = good", ""])(
    "leaves %j unchanged",
    (input) => {
      expect(neutralizeFormula(input)).toBe(input);
    },
  );
});

describe("toCsv", () => {
  it("writes a BOM, CRLF line endings and RFC 4180 quoting", () => {
    const csv = toCsv(["title", "notes"], [["Lunch, team", 'He said "hi"\nthen left']]);
    expect(csv).toBe('﻿title,notes\r\n"Lunch, team","He said ""hi""\nthen left"\r\n');
  });

  it("neutralizes formulas inside quoted cells", () => {
    const csv = toCsv(["description"], [['=IMPORTXML("http://x", "//a"),1']]);
    expect(csv).toContain('"\'=IMPORTXML(""http://x"", ""//a""),1"');
  });

  it("writes trusted numeric cells verbatim, including negatives", () => {
    const csv = toCsv(["amount", "net"], [[csvNumber("12.50"), csvNumber("-3.00")]]);
    expect(csv).toBe("﻿amount,net\r\n12.50,-3.00\r\n");
  });

  it("rejects malformed numeric cells", () => {
    expect(() => csvNumber("=1+1")).toThrow();
  });

  it("encodes empty values and booleans", () => {
    expect(toCsv(["a", "b", "c"], [[null, undefined, true]])).toBe("﻿a,b,c\r\n,,true\r\n");
  });

  it("refuses rows with the wrong number of cells", () => {
    expect(() => toCsv(["a", "b"], [["only one"]])).toThrow();
  });
});
