import { describe, expect, it } from "vitest";
import { isLocalOnlySupabase, readPublicSupabaseConfig, unsafeKeyReason } from "./env";

function fakeJwt(payload: object): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.signature`;
}

describe("readPublicSupabaseConfig", () => {
  it("accepts a project URL and publishable key", () => {
    expect(readPublicSupabaseConfig("https://abc.supabase.co/", "sb_publishable_123")).toEqual({
      url: "https://abc.supabase.co",
      publishableKey: "sb_publishable_123",
    });
  });

  it("accepts a legacy anon JWT", () => {
    const anon = fakeJwt({ role: "anon" });
    expect(readPublicSupabaseConfig("https://abc.supabase.co", anon)?.publishableKey).toBe(anon);
  });

  it("uses the project URL when an API endpoint was pasted instead", () => {
    for (const pasted of [
      "https://abc.supabase.co/rest/v1/",
      "https://abc.supabase.co/rest/v1",
      "https://abc.supabase.co/auth/v1/",
      "https://abc.supabase.co/",
    ]) {
      expect(readPublicSupabaseConfig(pasted, "sb_publishable_123")?.url, pasted).toBe("https://abc.supabase.co");
    }
    // Other paths (e.g. a self-hosted instance behind a prefix) are kept as configured.
    expect(readPublicSupabaseConfig("https://example.com/supabase", "sb_publishable_123")?.url).toBe(
      "https://example.com/supabase",
    );
  });

  it("treats missing or placeholder values as not configured", () => {
    expect(readPublicSupabaseConfig(undefined, "sb_publishable_123")).toBeNull();
    expect(readPublicSupabaseConfig("https://abc.supabase.co", "")).toBeNull();
    expect(readPublicSupabaseConfig("your-project-url", "your-publishable-or-anon-key")).toBeNull();
    expect(readPublicSupabaseConfig("not a url", "sb_publishable_123")).toBeNull();
  });

  it("refuses secret and service_role keys", () => {
    expect(() => readPublicSupabaseConfig("https://abc.supabase.co", "sb_secret_abc")).toThrow(/secret key/);
    expect(() => readPublicSupabaseConfig("https://abc.supabase.co", fakeJwt({ role: "service_role" }))).toThrow(
      /service_role/,
    );
    expect(unsafeKeyReason("sb_publishable_abc")).toBeNull();
  });
});

describe("isLocalOnlySupabase", () => {
  const emulator = "http://127.0.0.1:54321";

  it("flags the local emulator when the page was opened from another device", () => {
    expect(isLocalOnlySupabase(emulator, "192.168.1.18")).toBe(true);
    expect(isLocalOnlySupabase("http://localhost:54321", "my-pc.local")).toBe(true);
    expect(isLocalOnlySupabase("http://[::1]:54321", "lifeos-lan.test")).toBe(true);
  });

  it("does not flag pages opened on the same computer", () => {
    for (const host of ["localhost", "127.0.0.1", "app.localhost", "[::1]"]) {
      expect(isLocalOnlySupabase(emulator, host), host).toBe(false);
    }
  });

  it("does not flag a hosted Supabase project or invalid URLs", () => {
    expect(isLocalOnlySupabase("https://abc.supabase.co", "192.168.1.18")).toBe(false);
    expect(isLocalOnlySupabase("not a url", "192.168.1.18")).toBe(false);
  });
});
