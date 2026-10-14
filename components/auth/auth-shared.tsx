import { AlertTriangle } from "lucide-react";
import { getPublicSupabaseConfig } from "@/lib/env";
import { isNetworkError } from "@/lib/errors";

/** Shown instead of auth forms when the Supabase environment variables are missing. */
export function ConfigMissingNotice() {
  return (
    <div role="alert" className="grid gap-2 rounded-lg border border-warn/40 bg-warn/5 p-4 text-sm">
      <p className="flex items-center gap-2 font-medium text-warn">
        <AlertTriangle className="size-4" aria-hidden="true" />
        Supabase is not configured
      </p>
      <p className="text-fg-muted">
        Copy <code className="font-mono text-cyan-soft">.env.example</code> to{" "}
        <code className="font-mono text-cyan-soft">.env.local</code>, set{" "}
        <code className="font-mono text-cyan-soft">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="font-mono text-cyan-soft">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>, then restart the dev
        server.
      </p>
    </div>
  );
}

export function isSupabaseConfigured(): boolean {
  try {
    return getPublicSupabaseConfig() !== null;
  } catch {
    return false;
  }
}

/** Supabase Auth messages are user-facing already; only network failures need rewording. */
export function authErrorMessage(error: unknown): string {
  if (isNetworkError(error)) return "Can't reach the authentication service. Check your connection and try again.";
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}

export const PASSWORD_MIN_LENGTH = 8;
