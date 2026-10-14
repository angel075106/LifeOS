import { describe, expect, it, vi } from "vitest";
import { cn, newId } from "./utils";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("newId", () => {
  it("returns RFC 4122 v4 UUIDs", () => {
    const ids = new Set(Array.from({ length: 200 }, () => newId()));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(UUID_V4);
  });

  it("falls back to getRandomValues when randomUUID is unavailable", () => {
    // Shadow the prototype method, as on non-secure (plain HTTP) origins.
    Object.defineProperty(globalThis.crypto, "randomUUID", { value: undefined, configurable: true });
    const getRandomValues = vi.spyOn(globalThis.crypto, "getRandomValues");
    try {
      expect(newId()).toMatch(UUID_V4);
      expect(getRandomValues).toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(globalThis.crypto, "randomUUID");
      getRandomValues.mockRestore();
    }
    expect(typeof globalThis.crypto.randomUUID).toBe("function");
  });
});

describe("cn", () => {
  it("merges conflicting Tailwind classes", () => {
    expect(cn("px-2", "px-4", false && "hidden")).toBe("px-4");
  });
});
