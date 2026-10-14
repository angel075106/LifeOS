"use client";

import { useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * Reads and updates URL search params without a server round trip (history.replaceState is
 * synced with useSearchParams by Next.js). Filters survive reloads and can be bookmarked.
 */
export function useSearchParamState() {
  const searchParams = useSearchParams();

  const update = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === "") params.delete(key);
        else params.set(key, value);
      }
      const query = params.toString();
      window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
    },
    [searchParams],
  );

  return [searchParams, update] as const;
}
