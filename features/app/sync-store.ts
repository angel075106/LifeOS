"use client";

import { useSyncExternalStore } from "react";

/**
 * Connection state shared by the sync indicator and data hooks.
 *   live        - Realtime channel subscribed: other devices' changes arrive within seconds.
 *   connecting  - first connection in progress.
 *   unavailable - Realtime failed (not configured, blocked, or dropped); data still refreshes
 *                 on focus, reconnect and a periodic fallback poll.
 */
export type RealtimeState = "connecting" | "live" | "unavailable";

let realtimeState: RealtimeState = "connecting";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setRealtimeState(next: RealtimeState): void {
  if (next === realtimeState) return;
  realtimeState = next;
  for (const listener of listeners) listener();
}

export function useRealtimeState(): RealtimeState {
  return useSyncExternalStore(
    subscribe,
    () => realtimeState,
    () => "connecting",
  );
}

function subscribeOnline(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

/** Browser connectivity (navigator.onLine can report "online" on networks without internet). */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

const noopSubscribe = () => () => undefined;

/** False during server rendering and hydration, true once running in the browser. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
