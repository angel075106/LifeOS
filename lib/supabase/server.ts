import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requirePublicSupabaseConfig } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Server Supabase client bound to the current request's cookies.
 * Create a new client per request/function call; never share one across requests.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = requirePublicSupabaseConfig();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only. The proxy
          // refreshes sessions, so this is safe to ignore.
        }
      },
    },
  });
}

export type ServerUser = { id: string; email: string | null };

/**
 * Verifies the session JWT and returns the signed-in user, or null.
 * getClaims() validates the token signature; never trust unverified session data for
 * authorization decisions.
 */
export async function getServerUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<ServerUser | null> {
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}
