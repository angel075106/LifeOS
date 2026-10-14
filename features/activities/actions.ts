"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { findOverlappingActivities } from "@/lib/data/queries";
import { mapActivity } from "@/lib/data/mappers";
import {
  ActionFailure,
  CONFLICT_MESSAGE,
  invalidInput,
  isUniqueViolation,
  runAuthenticated,
} from "@/lib/server-action";
import type { Activity } from "@/lib/types";
import { createActivityInputSchema, updateActivityInputSchema } from "./schema";

export type SaveActivityResult =
  | { status: "saved"; activity: Activity }
  /** Nothing was written: the user must confirm saving over these overlapping activities. */
  | { status: "overlap"; overlaps: Activity[] };

const activityErrors = { duplicate: "This activity was already saved." };

export async function createActivity(raw: unknown): Promise<ActionResult<SaveActivityResult>> {
  const parsed = createActivityInputSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const input = parsed.data;

  return runAuthenticated(
    "activities.create",
    async ({ supabase, user }) => {
      if (!input.allowOverlap) {
        const overlaps = await findOverlappingActivities(supabase, Date.parse(input.startAt), Date.parse(input.endAt));
        if (overlaps.length > 0) return { status: "overlap", overlaps };
      }

      const fields = {
        category_id: input.categoryId,
        title: input.title,
        notes: input.notes,
        start_at: input.startAt,
        end_at: input.endAt,
        status: input.status,
      };
      const { data, error } = await supabase
        .from("activities")
        .insert({ id: input.id, user_id: user.id, ...fields })
        .select()
        .single();

      if (error && isUniqueViolation(error)) {
        // Same client-generated id: an earlier attempt of this submission (double tap, or a
        // retry after a timeout) already created the row. Apply the latest values to it.
        // RLS limits this to the caller's own row; another user's id updates nothing.
        const retried = await supabase.from("activities").update(fields).eq("id", input.id).select().maybeSingle();
        if (retried.error) throw retried.error;
        if (retried.data) return { status: "saved", activity: mapActivity(retried.data) };
      }
      if (error) throw error;
      return { status: "saved", activity: mapActivity(data) };
    },
    activityErrors,
  );
}

export async function updateActivity(raw: unknown): Promise<ActionResult<SaveActivityResult>> {
  const parsed = updateActivityInputSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const input = parsed.data;

  return runAuthenticated("activities.update", async ({ supabase }) => {
    if (!input.allowOverlap) {
      const overlaps = await findOverlappingActivities(
        supabase,
        Date.parse(input.startAt),
        Date.parse(input.endAt),
        input.id,
      );
      if (overlaps.length > 0) return { status: "overlap", overlaps };
    }

    const { data, error } = await supabase
      .from("activities")
      .update({
        category_id: input.categoryId,
        title: input.title,
        notes: input.notes,
        start_at: input.startAt,
        end_at: input.endAt,
        status: input.status,
      })
      .eq("id", input.id)
      .eq("updated_at", input.expectedUpdatedAt)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (data) return { status: "saved", activity: mapActivity(data) };

    // Nothing matched: either it changed elsewhere or it no longer exists.
    const current = await supabase.from("activities").select("id").eq("id", input.id).maybeSingle();
    if (current.error) throw current.error;
    throw new ActionFailure(
      current.data
        ? { code: "conflict", message: CONFLICT_MESSAGE }
        : { code: "not_found", message: "This activity no longer exists. It may have been deleted on another device." },
    );
  });
}

export async function deleteActivity(raw: unknown): Promise<ActionResult<{ id: string; alreadyDeleted: boolean }>> {
  const parsed = z.object({ id: z.uuid() }).safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const { id } = parsed.data;

  return runAuthenticated("activities.delete", async ({ supabase }) => {
    const { data, error } = await supabase.from("activities").delete().eq("id", id).select("id");
    if (error) throw error;
    return { id, alreadyDeleted: (data ?? []).length === 0 };
  });
}
