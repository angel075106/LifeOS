/**
 * Public Supabase configuration.
 *
 * Only the project URL and the publishable (anon) key are used anywhere in LifeOS. They are
 * safe to expose to browsers because every table is protected by RLS. Secret / service-role
 * keys must never be placed in NEXT_PUBLIC_* variables: they bypass RLS and would be shipped
 * to every visitor, so configuration containing one is rejected outright.
 */

export type PublicSupabaseConfig = { url: string; publishableKey: string };

const PLACEHOLDER_PATTERNS = [/your-project/i, /^your-/i, /\[insert/i];

/** Returns why a key must not be used client-side, or null when it looks publishable. */
export function unsafeKeyReason(key: string): string | null {
  if (key.startsWith("sb_secret_")) {
    return "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY contains a secret key (sb_secret_...). Use the publishable key.";
  }
  const parts = key.split(".");
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as { role?: unknown };
      if (payload.role === "service_role") {
        return "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY contains the service_role key. Use the anon/publishable key.";
      }
    } catch {
      // Not a decodable JWT: nothing to check.
    }
  }
  return null;
}

export function readPublicSupabaseConfig(
  url: string | undefined,
  publishableKey: string | undefined,
): PublicSupabaseConfig | null {
  if (!url || !publishableKey) return null;
  if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(url) || pattern.test(publishableKey))) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  } catch {
    return null;
  }
  const unsafe = unsafeKeyReason(publishableKey);
  if (unsafe) throw new Error(unsafe);
  return { url: url.replace(/\/+$/, ""), publishableKey };
}

/**
 * Reads the configuration. The variables are referenced directly so Next.js can inline
 * them into the browser bundle at build time.
 */
export function getPublicSupabaseConfig(): PublicSupabaseConfig | null {
  return readPublicSupabaseConfig(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function requirePublicSupabaseConfig(): PublicSupabaseConfig {
  const config = getPublicSupabaseConfig();
  if (!config) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
    );
  }
  return config;
}
