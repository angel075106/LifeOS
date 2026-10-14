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

/**
 * API endpoints that get pasted instead of the project URL (the dashboard also shows the REST
 * endpoint, https://<ref>.supabase.co/rest/v1/). Clients build every API path from the project
 * URL, so keeping such a suffix would send sign-in to ".../rest/v1/auth/v1/token" (HTTP 404).
 */
const API_PATH_SUFFIX = /\/(?:rest|auth|storage|realtime|functions|graphql)\/v1$/i;

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
  return { url: url.replace(/\/+$/, "").replace(API_PATH_SUFFIX, ""), publishableKey };
}

const LOOPBACK_HOSTNAME = /^(?:localhost|.+\.localhost|127(?:\.\d{1,3}){3}|\[::1\]|::1)$/i;

/**
 * True when Supabase is configured on this computer's loopback address (the local emulator,
 * e.g. http://127.0.0.1:54321) but the page was opened from another host, such as a phone on
 * the network. That device can never reach the authentication service.
 */
export function isLocalOnlySupabase(supabaseUrl: string, pageHostname: string): boolean {
  let supabaseHostname: string;
  try {
    supabaseHostname = new URL(supabaseUrl).hostname;
  } catch {
    return false;
  }
  return LOOPBACK_HOSTNAME.test(supabaseHostname) && !LOOPBACK_HOSTNAME.test(pageHostname);
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
