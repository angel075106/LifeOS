"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect } from "react";
import { isSyncedTable, type SyncedTable } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { setRealtimeState } from "./sync-store";

/** Coalesces bursts of notifications (bulk edits, our own writes echoing back). */
const DEBOUNCE_MS = 300;

/**
 * Subscribes to the user's private Realtime topic. Notifications carry only a table name;
 * the affected queries are re-fetched through the normal RLS-protected API. Because each
 * notification just triggers a refetch, duplicate or out-of-order events are harmless.
 */
export function RealtimeSync({ userId }: { userId: string }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = createClient();
    const pending = new Set<SyncedTable>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let channel: RealtimeChannel | null = null;
    let disposed = false;
    let needsFullRefresh = false;

    const flush = () => {
      timer = undefined;
      for (const table of pending) void queryClient.invalidateQueries({ queryKey: [table] });
      pending.clear();
    };

    const schedule = (table: SyncedTable) => {
      pending.add(table);
      timer ??= setTimeout(flush, DEBOUNCE_MS);
    };

    setRealtimeState("connecting");

    void (async () => {
      try {
        // Private channels are authorized with the user's JWT.
        await supabase.realtime.setAuth();
      } catch {
        // Fall through: subscribe() reports the failure via its status callback.
      }
      if (disposed) return;

      channel = supabase
        .channel(`user:${userId}`, { config: { private: true } })
        .on("broadcast", { event: "db_change" }, (message) => {
          const table = (message.payload as { table?: unknown } | undefined)?.table;
          if (isSyncedTable(table)) schedule(table);
        })
        .subscribe((status) => {
          if (disposed) return;
          if (status === "SUBSCRIBED") {
            setRealtimeState("live");
            // Changes may have been missed while disconnected: refresh everything once.
            if (needsFullRefresh) void queryClient.invalidateQueries();
            needsFullRefresh = false;
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            setRealtimeState("unavailable");
            needsFullRefresh = true;
          }
        });
    })();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return null;
}
