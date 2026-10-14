import { describe, expect, it, vi } from "vitest";
import { isNetworkError, logServerError, toAppError } from "./errors";

describe("toAppError", () => {
  it("maps PostgREST and Postgres codes to friendly messages", () => {
    expect(toAppError({ code: "23505", message: 'duplicate key value violates unique constraint "x"' })).toEqual({
      code: "duplicate",
      message: "That already exists.",
    });
    expect(toAppError({ code: "23001" }, { inUse: "Category is in use." }).message).toBe("Category is in use.");
    expect(toAppError({ code: "42501" }).code).toBe("forbidden");
    expect(toAppError({ code: "PGRST116" }).code).toBe("not_found");
    expect(toAppError({ code: "PGRST301" }).code).toBe("unauthenticated");
    expect(toAppError({ code: "23514" }).code).toBe("invalid");
  });

  it("never leaks internal details", () => {
    const internal = {
      code: "XX000",
      message: 'relation "public.secret" does not exist',
      details: "Key (user_id)=(...) is not present",
      hint: "check the schema",
    };
    const mapped = toAppError(internal);
    expect(mapped).toEqual({ code: "unknown", message: "Something went wrong. Please try again." });
    expect(JSON.stringify(mapped)).not.toContain("secret");
  });

  it("recognizes network failures from different browsers", () => {
    for (const message of ["Failed to fetch", "fetch failed", "NetworkError when attempting to fetch resource.", "Load failed"]) {
      expect(isNetworkError(new TypeError(message)), message).toBe(true);
      expect(toAppError(new TypeError(message)).code).toBe("network");
    }
    expect(isNetworkError(new Error("Invalid login credentials"))).toBe(false);
  });

  it("handles non-error values", () => {
    expect(toAppError(undefined).code).toBe("unknown");
    expect(toAppError("boom").code).toBe("unknown");
  });
});

describe("logServerError", () => {
  it("logs the scope and code but not the error message or payload", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logServerError("transactions.create", { code: "23514", message: "amount 123456 for Groceries" });
    expect(spy).toHaveBeenCalledWith("[lifeos] transactions.create failed", { code: "23514" });
    expect(JSON.stringify(spy.mock.calls)).not.toContain("123456");
    spy.mockRestore();
  });
});
