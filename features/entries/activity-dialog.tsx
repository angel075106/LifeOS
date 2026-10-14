"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, CalendarClock, CheckCircle2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch, type Path } from "react-hook-form";
import { CategoryChip } from "@/components/domain/display";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useToast } from "@/components/ui/toast";
import { createActivity, deleteActivity, updateActivity } from "@/features/activities/actions";
import {
  activityFormSchema,
  activityTimeError,
  type ActivityFormOutput,
  type ActivityFormValues,
} from "@/features/activities/schema";
import { useProfile } from "@/features/app/session";
import { useOnline } from "@/features/app/sync-store";
import { useActivityCategories, useActivityCategoryMap } from "@/features/data/hooks";
import { describeMutationError, useActionMutation } from "@/features/data/mutations";
import {
  addDays,
  diffInDays,
  formatClockTime,
  formatDuration,
  formatTimeOfDay,
  isValidLocalDate,
  localDateOfInstant,
  minutesOfDayInZone,
  parseTimeOfDay,
  todayInZone,
  zonedTimeToInstant,
  type LocalDate,
} from "@/lib/dates";
import type { Activity, ActivityCategory } from "@/lib/types";
import { newId } from "@/lib/utils";

export type ActivityDialogState =
  | { mode: "create"; date: LocalDate; startMinute?: number }
  | { mode: "edit"; activity: Activity };

const SERVER_FIELD_MAP: Record<string, Path<ActivityFormValues>> = {
  title: "title",
  categoryId: "categoryId",
  startAt: "startTime",
  endAt: "endTime",
  status: "status",
  notes: "notes",
};

function initialValues(
  state: ActivityDialogState,
  timeZone: string,
  categories: readonly ActivityCategory[],
): ActivityFormValues {
  if (state.mode === "edit") {
    const { activity } = state;
    return {
      title: activity.title,
      categoryId: activity.categoryId,
      startDate: localDateOfInstant(activity.startMs, timeZone),
      startTime: formatClockTime(activity.startMs, timeZone),
      endDate: localDateOfInstant(activity.endMs, timeZone),
      endTime: formatClockTime(activity.endMs, timeZone),
      status: activity.status,
      notes: activity.notes ?? "",
    };
  }

  const now = Date.now();
  const isToday = state.date === todayInZone(timeZone, now);
  const roundedNow = Math.ceil(minutesOfDayInZone(now, timeZone) / 15) * 15;
  const start = Math.min(state.startMinute ?? (isToday ? roundedNow : 9 * 60), 23 * 60 + 45);
  const end = start + 60;
  const endDate = end >= 1440 ? addDays(state.date, 1) : state.date;
  const endMs = zonedTimeToInstant(endDate, end % 1440, timeZone);

  return {
    title: "",
    categoryId: categories.find((category) => !category.isArchived)?.id ?? "",
    startDate: state.date,
    startTime: formatTimeOfDay(start),
    endDate,
    endTime: formatTimeOfDay(end % 1440),
    status: endMs <= now ? "completed" : "scheduled",
    notes: "",
  };
}

export function ActivityDialog({ state, onClose }: { state: ActivityDialogState | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const title = state?.mode === "edit" ? "Edit activity" : "New activity";
  return (
    <Dialog open={state !== null} onOpenChange={(open) => (!open && !busy ? onClose() : undefined)}>
      {state ? (
        <DialogContent
          title={title}
          description="Times use your profile time zone."
          busy={busy}
        >
          <ActivityForm
            key={state.mode === "edit" ? `${state.activity.id}:${state.activity.updatedAt}` : `new:${state.date}:${state.startMinute ?? ""}`}
            state={state}
            onDone={onClose}
            onBusyChange={setBusy}
          />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function ActivityForm({
  state,
  onDone,
  onBusyChange,
}: {
  state: ActivityDialogState;
  onDone: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const { timezone } = useProfile();
  const toast = useToast();
  const online = useOnline();
  const categoriesQuery = useActivityCategories();
  const categoryMap = useActivityCategoryMap();
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);

  // Stable for the lifetime of this dialog: retries reuse it, so no duplicate rows.
  const [recordId] = useState(() => (state.mode === "edit" ? state.activity.id : newId()));
  const [overlaps, setOverlaps] = useState<Activity[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const schema = useMemo(() => activityFormSchema(timezone), [timezone]);
  const [defaults] = useState(() => initialValues(state, timezone, categories));
  const previousStartDate = useRef(defaults.startDate);
  const form = useForm<ActivityFormValues, unknown, ActivityFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
    mode: "onTouched",
  });
  const { register, handleSubmit, formState, control, setValue, setError, getValues } = form;

  const [startDate, startTime, endDate, endTime, status] = useWatch({
    control,
    name: ["startDate", "startTime", "endDate", "endTime", "status"],
  });

  // Until the user picks a status, follow the end time: past -> completed, future -> scheduled.
  const statusChosen = Boolean(formState.dirtyFields.status);
  useEffect(() => {
    if (state.mode !== "create" || statusChosen) return;
    const endMinutes = parseTimeOfDay(endTime);
    if (!isValidLocalDate(endDate) || endMinutes === null) return;
    const next = zonedTimeToInstant(endDate, endMinutes, timezone) <= Date.now() ? "completed" : "scheduled";
    if (getValues("status") !== next) setValue("status", next);
  }, [endDate, endTime, timezone, state.mode, statusChosen, getValues, setValue]);

  // Categories may finish loading after the dialog opened: preselect the first one then.
  useEffect(() => {
    if (state.mode !== "create" || getValues("categoryId")) return;
    const first = categories.find((category) => !category.isArchived);
    if (first) setValue("categoryId", first.id);
  }, [categories, state.mode, getValues, setValue]);

  const create = useActionMutation(createActivity, ["activities"]);
  const update = useActionMutation(updateActivity, ["activities"]);
  const remove = useActionMutation(deleteActivity, ["activities"]);
  const saving = create.isPending || update.isPending;
  const durationLabel = useMemo(() => {
    const startMinutes = parseTimeOfDay(startTime);
    const endMinutes = parseTimeOfDay(endTime);
    if (!isValidLocalDate(startDate) || !isValidLocalDate(endDate) || startMinutes === null || endMinutes === null) {
      return null;
    }
    const startMs = zonedTimeToInstant(startDate, startMinutes, timezone);
    const endMs = zonedTimeToInstant(endDate, endMinutes, timezone);
    const problem = activityTimeError(startMs, endMs);
    return problem ? { error: problem } : { duration: formatDuration((endMs - startMs) / 60_000) };
  }, [startDate, startTime, endDate, endTime, timezone]);

  const selectableCategories = categories.filter(
    (category) => !category.isArchived || (state.mode === "edit" && category.id === state.activity.categoryId),
  );

  async function save(output: ActivityFormOutput, allowOverlap: boolean) {
    setFormError(null);
    onBusyChange(true);
    try {
      const payload = {
        title: output.title,
        categoryId: output.categoryId,
        startAt: output.startAt,
        endAt: output.endAt,
        status: output.status,
        notes: output.notes,
        allowOverlap,
      };
      const result =
        state.mode === "edit"
          ? await update.mutateAsync({ ...payload, id: recordId, expectedUpdatedAt: state.activity.updatedAt })
          : await create.mutateAsync({ ...payload, id: recordId });

      if (result.status === "overlap") {
        setOverlaps(result.overlaps);
        return;
      }
      toast.success(state.mode === "edit" ? "Activity updated" : "Activity saved", result.activity.title);
      onDone();
    } catch (error) {
      const appError = describeMutationError(error);
      for (const [field, message] of Object.entries(appError.fieldErrors ?? {})) {
        const target = SERVER_FIELD_MAP[field];
        if (target) setError(target, { message });
      }
      setFormError(appError.message);
    } finally {
      onBusyChange(false);
    }
  }

  async function handleDelete(): Promise<boolean> {
    if (state.mode !== "edit") return false;
    onBusyChange(true);
    try {
      const result = await remove.mutateAsync({ id: state.activity.id });
      toast.success(result.alreadyDeleted ? "Activity was already deleted" : "Activity deleted");
      onDone();
      return true;
    } catch (error) {
      toast.error("Couldn't delete the activity", describeMutationError(error).message);
      return false;
    } finally {
      onBusyChange(false);
    }
  }

  if (categoriesQuery.isSuccess && categories.length === 0) {
    return (
      <div className="grid gap-3 text-sm text-fg-muted">
        <p>You don&apos;t have any activity categories yet. Create one in Settings first.</p>
        <Button asChild variant="primary">
          <Link href="/settings#activity-categories" onClick={onDone}>
            Manage categories
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit((output) => save(output, false))}
      className="grid gap-4"
      aria-busy={saving}
    >
      <fieldset disabled={saving} className="grid gap-4">
        <Field id="activity-title" label="Title" required error={formState.errors.title?.message}>
          {(control) => (
            <Input {...control} {...register("title")} autoComplete="off" placeholder="e.g. Morning run" maxLength={120} />
          )}
        </Field>

        <Field id="activity-category" label="Category" required error={formState.errors.categoryId?.message}>
          {(control) => (
            <Select {...control} {...register("categoryId")} disabled={!categoriesQuery.isSuccess}>
              <option value="" disabled>
                {categoriesQuery.isPending ? "Loading categories…" : "Choose a category"}
              </option>
              {selectableCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {category.isArchived ? " (archived)" : ""}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field id="activity-start-date" label="Start date" required error={formState.errors.startDate?.message}>
            {(control) => (
              <Input
                {...control}
                type="date"
                {...register("startDate", {
                  onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                    // Move the end date along, keeping same-day entries same-day and
                    // overnight entries (e.g. sleep) overnight.
                    const previous = previousStartDate.current;
                    const next = event.target.value;
                    const end = getValues("endDate");
                    if (isValidLocalDate(previous) && isValidLocalDate(next) && isValidLocalDate(end)) {
                      const offset = diffInDays(end, previous);
                      if (offset === 0 || offset === 1) {
                        setValue("endDate", addDays(next, offset), { shouldValidate: formState.isSubmitted });
                      }
                    }
                    previousStartDate.current = next;
                  },
                })}
              />
            )}
          </Field>
          <Field id="activity-start-time" label="Start time" required error={formState.errors.startTime?.message}>
            {(control) => <Input {...control} type="time" step={300} {...register("startTime")} />}
          </Field>
          <Field id="activity-end-date" label="End date" required error={formState.errors.endDate?.message}>
            {(control) => <Input {...control} type="date" {...register("endDate")} />}
          </Field>
          <Field id="activity-end-time" label="End time" required error={formState.errors.endTime?.message}>
            {(control) => <Input {...control} type="time" step={300} {...register("endTime")} />}
          </Field>
        </div>

        <p className="-mt-1 text-xs tabular-nums" aria-live="polite">
          {durationLabel === null ? (
            <span className="text-fg-subtle">Duration: enter a start and end time</span>
          ) : "error" in durationLabel ? (
            <span className="text-warning">{durationLabel.error}</span>
          ) : (
            <span className="font-medium text-fg">Duration {durationLabel.duration}</span>
          )}
          <span className="text-fg-subtle"> · {timezone}</span>
        </p>

        <div className="grid gap-1.5">
          <span className="text-[13px] font-medium text-fg" id="activity-status-label">
            Status
          </span>
          <SegmentedControl
            label="Status"
            value={status}
            onChange={(value) => setValue("status", value, { shouldDirty: true })}
            options={[
              { value: "completed", label: "Completed", icon: <CheckCircle2 aria-hidden="true" /> },
              { value: "scheduled", label: "Scheduled", icon: <CalendarClock aria-hidden="true" /> },
            ]}
            className="w-full"
          />
        </div>

        <Field id="activity-notes" label="Notes" error={formState.errors.notes?.message}>
          {(control) => <Textarea {...control} {...register("notes")} rows={3} maxLength={2000} placeholder="Optional" />}
        </Field>
      </fieldset>

      {overlaps ? (
        <div role="alert" className="grid gap-3 rounded-lg border border-warning/30 bg-warning-soft p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-warning">
            <AlertTriangle className="size-4" aria-hidden="true" />
            Overlaps with {overlaps.length} {overlaps.length === 1 ? "activity" : "activities"}
          </p>
          <ul className="grid gap-1.5 text-xs">
            {overlaps.map((overlap) => {
              const category = categoryMap.get(overlap.categoryId);
              return (
                <li key={overlap.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="tabular-nums text-fg-muted">
                    {localDateOfInstant(overlap.startMs, timezone) !== startDate
                      ? `${localDateOfInstant(overlap.startMs, timezone)} `
                      : ""}
                    {formatClockTime(overlap.startMs, timezone)}–{formatClockTime(overlap.endMs, timezone)}
                  </span>
                  <span className="text-fg">{overlap.title}</span>
                  {category ? <CategoryChip name={category.name} color={category.color} /> : null}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-fg-muted">Overlaps are allowed when intended, e.g. a call during a commute.</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setOverlaps(null)} disabled={saving}>
              Go back
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={saving}
              onClick={handleSubmit((output) => save(output, true))}
            >
              Save anyway
            </Button>
          </div>
        </div>
      ) : null}

      <FormError message={formError} />
      {!online ? (
        <p className="text-xs text-warning">You appear to be offline. Saving needs a connection.</p>
      ) : null}

      {!overlaps ? (
        <div className="-mx-5 flex flex-col-reverse gap-2 border-t border-border px-5 pt-4 sm:flex-row sm:items-center">
          {state.mode === "edit" ? (
            <Button
              type="button"
              variant="ghost"
              className="text-expense hover:text-expense sm:mr-auto"
              onClick={() => setConfirmDelete(true)}
              disabled={saving || remove.isPending}
            >
              <Trash2 aria-hidden="true" />
              Delete
            </Button>
          ) : null}
          <Button type="submit" variant="primary" loading={saving} className="sm:ml-auto sm:min-w-32">
            {state.mode === "edit" ? "Save changes" : "Save activity"}
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this activity?"
        description={
          state.mode === "edit" ? (
            <>
              <strong className="text-fg">{state.activity.title}</strong> will be permanently deleted on all your
              devices.
            </>
          ) : null
        }
        onConfirm={handleDelete}
      />
    </form>
  );
}
