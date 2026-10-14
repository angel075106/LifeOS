import { describe, expect, it } from "vitest";
import { readPublicSupabaseConfig, unsafeKeyReason } from "./env";

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
