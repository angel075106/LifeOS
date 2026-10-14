"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Globe, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { describeMutationError, useActionMutation } from "@/features/data/mutations";
import { updateProfile } from "@/features/settings/actions";
import { deviceTimeZone } from "@/lib/dates";
import { queryKeys } from "@/lib/query-keys";
import { useProfile } from "./session";

const DISMISS_KEY = "lifeos.tz-notice-dismissed";
const noopSubscribe = () => () => undefined;

function readDismissed(): string | null {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

/**
 * Offers to switch the profile time zone when this device is in a different one (e.g. while
 * travelling, or for accounts created before the time zone was recorded).
 */
export function TimezoneNotice() {
  const profile = useProfile();
  const toast = useToast();
  const queryClient = useQueryClient();
  const device = useSyncExternalStore(noopSubscribe, deviceTimeZone, () => profile.timezone);
  const storedDismissal = useSyncExternalStore(noopSubscribe, readDismissed, () => null);
  const [dismissedNow, setDismissedNow] = useState<string | null>(null);
  const save = useActionMutation(updateProfile, ["profiles"]);

  const dismissedFor = dismissedNow ?? storedDismissal;
  if (device === profile.timezone || dismissedFor === device) return null;

  function dismiss() {
    setDismissedNow(device);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, device);
    } catch {
      // Storage unavailable (private mode): dismissal lasts for this page only.
    }
  }

  async function switchZone() {
    try {
      const saved = await save.mutateAsync({
        displayName: profile.displayName ?? "",
        currency: profile.currency,
        timezone: device,
        defaultCalendarView: profile.defaultCalendarView,
        weekStartsOn: profile.weekStartsOn,
      });
      queryClient.setQueryData(queryKeys.profile, saved);
      toast.success("Time zone updated", device.replace(/_/g, " "));
    } catch (caught) {
      toast.error("Couldn't update the time zone", describeMutationError(caught).message);
    }
  }

  return (
    <div role="status" className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm shadow-card">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-text" aria-hidden="true">
        <Globe className="size-4" />
      </span>
      <p className="min-w-0 flex-1 text-fg-muted">
        This device is in <strong className="text-fg">{device.replace(/_/g, " ")}</strong>, but LifeOS shows times in{" "}
        <strong className="text-fg">{profile.timezone.replace(/_/g, " ")}</strong>.
      </p>
      <Button variant="primary" size="sm" onClick={switchZone} loading={save.isPending}>
        Use {device.split("/").pop()?.replace(/_/g, " ")}
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={dismiss} aria-label="Dismiss time zone notice">
        <X aria-hidden="true" />
      </Button>
    </div>
  );
}
