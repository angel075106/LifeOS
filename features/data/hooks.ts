"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useProfile } from "@/features/app/session";
import { useRealtimeState } from "@/features/app/sync-store";
import { dateRangeInstants, type LocalDate } from "@/lib/dates";
import {
  fetchActivitiesOverlapping,
  fetchActivityCategories,
  fetchBudgets,
  fetchFinanceCategories,
  fetchRecentTransactions,
  fetchTransactionsBetween,
} from "@/lib/data/queries";
import { queryKeys } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import type { ActivityCategory, FinanceCategory } from "@/lib/types";

/** Poll interval used only while the Realtime channel is unavailable. */
const FALLBACK_POLL_MS = 60_000;

function useFallbackPolling(): number | false {
  return useRealtimeState() === "live" ? false : FALLBACK_POLL_MS;
}

export function useActivityCategories() {
  const refetchInterval = useFallbackPolling();
  return useQuery({
    queryKey: queryKeys.activityCategories,
    queryFn: () => fetchActivityCategories(createClient()),
    refetchInterval,
  });
}

export function useFinanceCategories() {
  const refetchInterval = useFallbackPolling();
  return useQuery({
    queryKey: queryKeys.financeCategories,
    queryFn: () => fetchFinanceCategories(createClient()),
    refetchInterval,
  });
}

export function useActivityCategoryMap(): Map<string, ActivityCategory> {
  const { data } = useActivityCategories();
  return useMemo(() => new Map((data ?? []).map((category) => [category.id, category])), [data]);
}

export function useFinanceCategoryMap(): Map<string, FinanceCategory> {
  const { data } = useFinanceCategories();
  return useMemo(() => new Map((data ?? []).map((category) => [category.id, category])), [data]);
}

/** Activities overlapping local days `from`..`to` (inclusive) in the profile time zone. */
export function useActivitiesForDays(from: LocalDate, to: LocalDate) {
  const { timezone } = useProfile();
  const refetchInterval = useFallbackPolling();
  const { start, end } = useMemo(() => dateRangeInstants(from, to, timezone), [from, to, timezone]);
  return useQuery({
    queryKey: queryKeys.activitiesRange(start, end),
    queryFn: () => fetchActivitiesOverlapping(createClient(), start, end),
    placeholderData: keepPreviousData,
    refetchInterval,
  });
}

/** Transactions dated `from`..`to` inclusive. */
export function useTransactionsForDays(from: LocalDate, to: LocalDate) {
  const refetchInterval = useFallbackPolling();
  return useQuery({
    queryKey: queryKeys.transactionsRange(from, to),
    queryFn: () => fetchTransactionsBetween(createClient(), from, to),
    placeholderData: keepPreviousData,
    refetchInterval,
  });
}

export function useBudgets(fromMonth: LocalDate, toMonth: LocalDate) {
  const refetchInterval = useFallbackPolling();
  return useQuery({
    queryKey: queryKeys.budgets(fromMonth, toMonth),
    queryFn: () => fetchBudgets(createClient(), fromMonth, toMonth),
    refetchInterval,
  });
}

export function useRecentTransactions(limit = 8) {
  const refetchInterval = useFallbackPolling();
  return useQuery({
    queryKey: queryKeys.recentTransactions(limit),
    queryFn: () => fetchRecentTransactions(createClient(), limit),
    refetchInterval,
  });
}
