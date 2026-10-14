import { createBrowserClient } from "@supabase/ssr";
import { requirePublicSupabaseConfig } from "@/lib/env";
import type { Database } from "./database.types";
import type { TypedSupabaseClient } from "./typed-client";

/**
 * Browser Supabase client. Sessions live in cookies (managed by @supabase/ssr) so the server
 * and proxy see the same session. @supabase/ssr returns a singleton in the browser.
 */
export function createClient(): TypedSupabaseClient {
  const { url, publishableKey } = requirePublicSupabaseConfig();
  return createBrowserClient<Database>(url, publishableKey);
}
