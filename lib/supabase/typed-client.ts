import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/** Supabase client typed with the LifeOS schema (browser or server). */
export type TypedSupabaseClient = SupabaseClient<Database>;
