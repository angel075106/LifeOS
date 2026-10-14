"use client";

import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { clearServiceWorkerCaches } from "@/components/pwa/service-worker-registration";
import { EntryDialogsProvider } from "@/features/entries/entry-dialogs";
import { isNetworkError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { RealtimeSync } from "./realtime-sync";
import { SessionProvider } from "./session";

/** Retry only failures that can succeed on retry (network); never auth or validation errors. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  return failureCount < 2 && isNetworkError(error);
}

/**
 * Reacts to auth changes made elsewhere (another tab signing out, an expired refresh token,
 * or a different user signing in) so private data is never shown to the wrong session.
 */
function AuthWatcher({ userId }: { userId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        queryClient.clear();
        clearServiceWorkerCaches();
        router.replace("/auth/login");
        router.refresh();
      } else if (session && session.user.id !== userId) {
        // Another account signed in on this browser: reload to start from a clean state.
        window.location.reload();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [userId, router, queryClient]);

  return null;
}

type AppProvidersProps = {
  session: { userId: string; email: string | null; initialProfile: Profile };
  children: React.ReactNode;
};

export function AppProviders({ session, children }: AppProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 10 * 60_000,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            retry: shouldRetry,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider value={session}>
        <ToastProvider>
          <EntryDialogsProvider>
            <AuthWatcher userId={session.userId} />
            <RealtimeSync userId={session.userId} />
            {children}
          </EntryDialogsProvider>
        </ToastProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
