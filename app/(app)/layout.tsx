import { redirect, unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppShellSkeleton, SetupRequired } from "@/features/app/app-states";
import { AppShell } from "@/features/app/app-shell";
import { AppProviders } from "@/features/app/providers";
import { fetchProfile } from "@/lib/data/queries";
import { logServerError } from "@/lib/errors";
import { createClient, getServerUser } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/**
 * Authenticated area. The session is read at request time, so it sits behind a Suspense
 * boundary (Cache Components): the static shell is a skeleton containing no user data.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <AuthenticatedApp>{children}</AuthenticatedApp>
    </Suspense>
  );
}

async function loadProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<Profile | "missing-schema" | null> {
  try {
    const profile = await fetchProfile(supabase, userId);
    if (profile) return profile;
    // Signed up before the database was set up: create the profile and default categories.
    const { error } = await supabase.rpc("bootstrap_current_user");
    if (error) throw error;
    return await fetchProfile(supabase, userId);
  } catch (error) {
    unstable_rethrow(error);
    logServerError("app.loadProfile", error);
    const code = (error as { code?: unknown }).code;
    // PostgREST: relation/function not found -> migrations have not been applied.
    return code === "PGRST205" || code === "PGRST202" || code === "42P01" ? "missing-schema" : null;
  }
}

async function AuthenticatedApp({ children }: { children: React.ReactNode }) {
  // Verifying a session compares token expiry with the current time, so this must run at
  // request time - never as part of a prerendered (or per-session prefetched) shell.
  await connection();
  const supabase = await createClient();
  const user = await getServerUser(supabase);
  if (!user) redirect("/auth/login");

  const profile = await loadProfile(supabase, user.id);
  if (profile === "missing-schema") return <SetupRequired reason="schema" />;
  if (!profile) return <SetupRequired reason="profile" />;

  return (
    <AppProviders session={{ userId: user.id, email: user.email, initialProfile: profile }}>
      <AppShell>{children}</AppShell>
    </AppProviders>
  );
}
