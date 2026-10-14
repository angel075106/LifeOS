"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, useContext } from "react";
import { fetchProfile } from "@/lib/data/queries";
import { queryKeys } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

type Session = { userId: string; email: string | null; initialProfile: Profile };

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ value, children }: { value: Session; children: React.ReactNode }) {
  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside the authenticated app");
  return session;
}

/** The signed-in user's profile, kept fresh by TanStack Query (and Realtime). */
export function useProfile(): Profile {
  const { userId, initialProfile } = useSession();
  const { data } = useQuery({
    queryKey: queryKeys.profile,
    queryFn: async () => (await fetchProfile(createClient(), userId)) ?? initialProfile,
    initialData: initialProfile,
  });
  return data;
}
