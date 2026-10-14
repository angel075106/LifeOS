import { AlertTriangle } from "lucide-react";
import type * as React from "react";
import { getPublicSupabaseConfig, isLocalOnlySupabase } from "@/lib/env";
import { isNetworkError } from "@/lib/errors";

/** Card used by every sign-in screen. The title is the page heading. */
export function AuthCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-card">
      <div className="mb-5 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-tight text-fg">{title}</h1>
          {description ? <p className="mt-1 text-sm text-fg-muted">{description}</p> : null}
        </div>
        {icon}
      </div>
      {children}
    </section>
  );
}

/** Shown instead of auth forms when the Supabase environment variables are missing. */
export function ConfigMissingNotice() {
  return (
    <div role="alert" className="grid gap-2 rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm">
      <p className="flex items-center gap-2 font-medium text-warning">
        <AlertTriangle className="size-4" aria-hidden="true" />
        Supabase is not configured
      </p>
      <p className="text-fg-muted">
        Copy <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px] text-fg">.env.example</code> to{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px] text-fg">.env.local</code>, set{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px] text-fg">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px] text-fg">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>, then restart the dev
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

/** The page was opened from another device, but Supabase runs only on this computer. */
function usesLocalOnlySupabase(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const config = getPublicSupabaseConfig();
    return config !== null && isLocalOnlySupabase(config.url, window.location.hostname);
  } catch {
    return false;
  }
}

/** Supabase Auth messages are user-facing already; only network failures need rewording. */
export function authErrorMessage(error: unknown): string {
  if (isNetworkError(error)) {
    if (usesLocalOnlySupabase()) {
      return "This server uses the local test database, which only the computer running it can reach. To sign in from this device, run LifeOS with your Supabase project (npm run dev).";
    }
    return "Can't reach the authentication service. Check your connection and try again.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}

export const PASSWORD_MIN_LENGTH = 8;
