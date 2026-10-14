"use client";

import { useIsFetching, useIsMutating, useQueryClient } from "@tanstack/react-query";
import { CloudOff, Loader2, Radio, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useProfile } from "./session";
import { formatClockTime } from "@/lib/dates";
import { useHydrated, useOnline, useRealtimeState } from "./sync-store";

/** Time of the most recent successful data fetch. */
function useLastSyncedAt(): number | null {
  const queryClient = useQueryClient();
  const [last, setLast] = useState<number | null>(() => {
    const times = queryClient.getQueryCache().getAll().map((query) => query.state.dataUpdatedAt);
    const latest = Math.max(0, ...times);
    return latest > 0 ? latest : null;
  });
  useEffect(
    () =>
      queryClient.getQueryCache().subscribe((event) => {
        if (event.type === "updated" && event.action.type === "success") setLast(Date.now());
      }),
    [queryClient],
  );
  return last;
}

export function SyncIndicator({ compact = false }: { compact?: boolean }) {
  const online = useOnline();
  const realtime = useRealtimeState();
  const fetching = useIsFetching() > 0;
  const saving = useIsMutating() > 0;
  // The time differs between the server render and the browser, so it is only shown after
  // hydration (otherwise React would discard the server HTML on a mismatch).
  const hydrated = useHydrated();
  const lastSync = useLastSyncedAt();
  const lastSyncedAt = hydrated ? lastSync : null;
  const { timezone } = useProfile();

  let tone: "ok" | "warn" | "busy";
  let label: string;
  let detail: string;
  let Icon = Radio;

  if (!online) {
    tone = "warn";
    label = "Offline";
    detail = "You're offline. Showing the last loaded data; changes can't be saved until you reconnect.";
    Icon = CloudOff;
  } else if (saving) {
    tone = "busy";
    label = "Saving";
    detail = "Saving your change…";
    Icon = Loader2;
  } else if (realtime === "live") {
    tone = fetching ? "busy" : "ok";
    label = fetching ? "Syncing" : "Live";
    detail = "Live sync is on: changes from your other devices appear automatically.";
  } else if (realtime === "connecting") {
    tone = "busy";
    label = "Connecting";
    detail = "Connecting to live sync…";
  } else {
    tone = "warn";
    label = "Auto-refresh";
    detail =
      "Live sync is unavailable. Data refreshes when you return to the app, when you reconnect, and every minute.";
    Icon = RefreshCw;
  }

  const synced = lastSyncedAt ? `Last synced ${formatClockTime(lastSyncedAt, timezone)}.` : "";

  return (
    <div
      role="status"
      title={`${detail} ${synced}`.trim()}
      className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap text-xs font-medium text-fg-muted"
    >
      {tone === "ok" ? (
        <span className="size-2 shrink-0 rounded-full bg-income" aria-hidden="true" />
      ) : (
        <Icon
          className={cn(
            "size-3.5 shrink-0",
            tone === "warn" ? "text-warning" : "text-accent-text",
            Icon === Loader2 && "animate-spin motion-reduce:animate-none",
          )}
          aria-hidden="true"
        />
      )}
      <span>{label}</span>
      <span className="sr-only">
        {detail} {synced}
      </span>
      {!compact && lastSyncedAt ? (
        <span className="font-normal tabular-nums text-fg-subtle" aria-hidden="true">
          · {formatClockTime(lastSyncedAt, timezone)}
        </span>
      ) : null}
    </div>
  );
}
