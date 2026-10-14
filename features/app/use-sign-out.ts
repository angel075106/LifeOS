"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { clearServiceWorkerCaches } from "@/components/pwa/service-worker-registration";
import { toAppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";

/**
 * Signs out and removes cached private data from memory (and asks the service worker to
 * drop any caches). "local" signs out this device only; "global" ends every session.
 */
export function useSignOut() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  async function signOut(scope: "local" | "global" = "local"): Promise<boolean> {
    if (pending) return false;
    setPending(true);
    try {
      const { error } = await createClient().auth.signOut({ scope });
      if (error) {
        toast.error("Couldn't sign out", toAppError(error).message);
        return false;
      }
      queryClient.clear();
      clearServiceWorkerCaches();
      router.replace("/auth/login");
      router.refresh();
      return true;
    } finally {
      setPending(false);
    }
  }

  return { signOut, pending };
}
