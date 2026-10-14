import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

const ORIGIN = "https://lifeos.example";

describe("safeRedirectPath", () => {
  it.each([
    ["/calendar", "/calendar"],
    ["/finance?tab=budgets", "/finance?tab=budgets"],
    ["/calendar?view=week&date=2026-10-14#top", "/calendar?view=week&date=2026-10-14#top"],
    ["https://lifeos.example/stats", "/stats"],
    ["/auth/update-password", "/auth/update-password"],
  ])("allows %j", (input, expected) => {
    expect(safeRedirectPath(input, ORIGIN)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    "",
    "https://evil.example/phish",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "/\t/evil.example",
    "javascript:alert(1)",
    "data:text/html,hi",
    "http://lifeos.example/calendar", // different origin (scheme)
    "https://lifeos.example.evil.example/",
    "/auth/confirm?next=https://evil.example",
    "/auth/callback?code=abc",
    `/${"a".repeat(3000)}`,
  ])("rejects %j", (input) => {
    expect(safeRedirectPath(input, ORIGIN)).toBe("/calendar");
  });

  it("uses the provided fallback", () => {
    expect(safeRedirectPath("https://evil.example", ORIGIN, "/settings")).toBe("/settings");
  });
});
