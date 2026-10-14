"use client";

import { Activity as ActivityIcon, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ActivityRow } from "@/components/domain/entry-rows";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { useProfile } from "@/features/app/session";
import { useHydrated } from "@/features/app/sync-store";
import { useActivitiesForDays, useActivityCategories, useActivityCategoryMap } from "@/features/data/hooks";
import { useEntryDialogs } from "@/features/entries/entry-dialogs";
import {
  activityLocalDate,
  filterActivities,
  groupByDate,
  isRangePreset,
  limitGroups,
  resolveRange,
  type RangePreset,
} from "@/features/shared/list-filters";
import { RangePicker } from "@/features/shared/range-picker";
import { useSearchParamState } from "@/features/shared/use-search-param-state";
import { dateRangeInstants, formatDuration, formatLocalDate, overlapMs, todayInZone } from "@/lib/dates";
import { toAppError } from "@/lib/errors";
import { ACTIVITY_STATUSES, type ActivityStatus } from "@/lib/types";

function isActivityStatus(value: unknown): value is ActivityStatus {
  return typeof value === "string" && (ACTIVITY_STATUSES as readonly string[]).includes(value);
}

const PAGE_SIZE = 100;

export function ActivitiesScreen() {
  const hydrated = useHydrated();
  if (!hydrated) return <Skeleton className="h-[70dvh]" />;
  return <ActivitiesContent />;
}

function ActivitiesContent() {
  const profile = useProfile();
  const { openActivity } = useEntryDialogs();
  const [params, setParams] = useSearchParamState();
  const [visible, setVisible] = useState(PAGE_SIZE);
  const today = todayInZone(profile.timezone);

  const rangeParam = params.get("range");
  const preset: RangePreset = isRangePreset(rangeParam) ? rangeParam : "this-month";
  const range = resolveRange(preset, today, profile.weekStartsOn, { from: params.get("from"), to: params.get("to") });
  const query = params.get("q") ?? "";
  const categoryId = params.get("category");
  const statusParam = params.get("status");
  const status = isActivityStatus(statusParam) ? statusParam : null;
  const sort = params.get("sort") === "oldest" ? "oldest" : "newest";

  const activitiesQuery = useActivitiesForDays(range.from, range.to);
  const categoriesQuery = useActivityCategories();
  const categoryMap = useActivityCategoryMap();

  const filtered = useMemo(
    () =>
      filterActivities(activitiesQuery.data ?? [], { query, categoryId, status }, (id) => categoryMap.get(id)?.name),
    [activitiesQuery.data, query, categoryId, status, categoryMap],
  );

  const totalMinutes = useMemo(() => {
    const bounds = dateRangeInstants(range.from, range.to, profile.timezone);
    return filtered.reduce(
      (sum, activity) => sum + overlapMs(activity.startMs, activity.endMs, bounds.start, bounds.end) / 60_000,
      0,
    );
  }, [filtered, range.from, range.to, profile.timezone]);

  const groups = useMemo(
    () => groupByDate(filtered, (activity) => activityLocalDate(activity, profile.timezone), (activity) => activity.startMs, sort),
    [filtered, profile.timezone, sort],
  );

  // Whole day groups, until roughly `visible` items are shown.
  const shownGroups = useMemo(() => limitGroups(groups, visible), [groups, visible]);

  const hasFilters = Boolean(query || categoryId || status);
  const loading = activitiesQuery.isPending || activitiesQuery.isPlaceholderData;

  return (
    <>
      <PageHeader
        eyebrow="Activity log"
        title="Activities"
        description="Everything you tracked, searchable and filterable."
        actions={
          <Button variant="primary" onClick={() => openActivity({ mode: "create", date: today })}>
            <Plus aria-hidden="true" />
            New activity
          </Button>
        }
      />

      <Panel padding="sm" className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid min-w-48 flex-1 gap-1.5">
            <Label htmlFor="activity-search">Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
              <Input
                id="activity-search"
                type="search"
                value={query}
                onChange={(event) => setParams({ q: event.target.value })}
                placeholder="Title, notes or category"
                className="pl-9"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="activity-category-filter">Category</Label>
            <Select
              id="activity-category-filter"
              value={categoryId ?? ""}
              onChange={(event) => setParams({ category: event.target.value })}
              className="w-40"
            >
              <option value="">All categories</option>
              {(categoriesQuery.data ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {category.isArchived ? " (archived)" : ""}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="activity-status-filter">Status</Label>
            <Select
              id="activity-status-filter"
              value={status ?? ""}
              onChange={(event) => setParams({ status: event.target.value })}
              className="w-36"
            >
              <option value="">Any status</option>
              <option value="completed">Completed</option>
              <option value="scheduled">Scheduled</option>
            </Select>
          </div>
          <RangePicker
            idPrefix="activities"
            preset={preset}
            from={range.from}
            to={range.to}
            onChange={(next) =>
              setParams({
                range: next.preset,
                from: next.preset === "custom" ? next.from : null,
                to: next.preset === "custom" ? next.to : null,
              })
            }
          />
          <div className="grid gap-1.5">
            <Label htmlFor="activity-sort">Order</Label>
            <Select id="activity-sort" value={sort} onChange={(event) => setParams({ sort: event.target.value })} className="w-36">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </Select>
          </div>
        </div>
      </Panel>

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" aria-live="polite">
        <span className="text-fg-muted">
          <span className="font-mono text-fg">{filtered.length}</span> {filtered.length === 1 ? "activity" : "activities"}
        </span>
        <span className="text-fg-muted">
          <span className="font-mono text-cyan-soft">{formatDuration(totalMinutes)}</span> tracked in this period
        </span>
        {hasFilters ? (
          <button
            type="button"
            onClick={() => setParams({ q: null, category: null, status: null })}
            className="inline-flex items-center gap-1 text-xs text-cyan underline-offset-4 hover:underline"
          >
            <X className="size-3" aria-hidden="true" />
            Clear filters
          </button>
        ) : null}
      </div>

      {activitiesQuery.error ? (
        <ErrorState message={toAppError(activitiesQuery.error).message} onRetry={() => void activitiesQuery.refetch()} />
      ) : loading && !activitiesQuery.data ? (
        <div className="grid gap-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<ActivityIcon aria-hidden="true" />}
          title={hasFilters ? "No activities match these filters" : "No activities in this period"}
          description={hasFilters ? "Try a different search or clear the filters." : "Log what you did to see it here."}
          action={
            hasFilters ? (
              <Button variant="secondary" size="sm" onClick={() => setParams({ q: null, category: null, status: null })}>
                Clear filters
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={() => openActivity({ mode: "create", date: today })}>
                <Plus aria-hidden="true" />
                New activity
              </Button>
            )
          }
        />
      ) : (
        <div className={loading ? "grid gap-5 opacity-60 transition-opacity" : "grid gap-5"} aria-busy={loading}>
          {shownGroups.map((group) => (
            <section key={group.date} aria-labelledby={`day-${group.date}`} className="grid gap-2">
              <h2 id={`day-${group.date}`} className="hud-label flex items-center gap-2">
                <span className={group.date === today ? "text-cyan" : undefined}>
                  {formatLocalDate(group.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                </span>
                {group.date === today ? <span className="text-cyan">· today</span> : null}
                <span className="h-px flex-1 bg-line" aria-hidden="true" />
                <span>{group.items.length}</span>
              </h2>
              <ul className="grid gap-1.5">
                {group.items.map((activity) => (
                  <li key={activity.id}>
                    <ActivityRow
                      activity={activity}
                      category={categoryMap.get(activity.categoryId)}
                      timeZone={profile.timezone}
                      onOpen={(item) => openActivity({ mode: "edit", activity: item })}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {shownGroups.length < groups.length ? (
            <Button variant="secondary" className="justify-self-center" onClick={() => setVisible((count) => count + PAGE_SIZE)}>
              Show more
            </Button>
          ) : null}
        </div>
      )}
    </>
  );
}
