"use server";

import type { ActionResult } from "@/lib/action-result";
import { mapActivityCategory, mapFinanceCategory } from "@/lib/data/mappers";
import { ActionFailure, invalidInput, isUniqueViolation, runAuthenticated } from "@/lib/server-action";
import type { ActivityCategory, FinanceCategory } from "@/lib/types";
import {
  createActivityCategorySchema,
  createFinanceCategorySchema,
  deleteCategorySchema,
  updateCategorySchema,
} from "./schema";

const errors = {
  duplicate: "A category with this name already exists.",
  inUse: "This category is still used. Choose a replacement category to move its entries to.",
};

async function nextSortOrder(
  query: PromiseLike<{ data: { sort_order: number }[] | null; error: unknown }>,
): Promise<number> {
  const { data, error } = await query;
  if (error) throw error;
  return (data?.[0]?.sort_order ?? 0) + 10;
}

export async function createActivityCategory(raw: unknown): Promise<ActionResult<ActivityCategory>> {
  const parsed = createActivityCategorySchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const input = parsed.data;

  return runAuthenticated(
    "activity_categories.create",
    async ({ supabase, user }) => {
      const sortOrder = await nextSortOrder(
        supabase.from("activity_categories").select("sort_order").order("sort_order", { ascending: false }).limit(1),
      );
      const { data, error } = await supabase
        .from("activity_categories")
        .insert({ id: input.id, user_id: user.id, name: input.name, color: input.color, sort_order: sortOrder })
        .select()
        .single();
      if (error && isUniqueViolation(error)) {
        const existing = await supabase.from("activity_categories").select("*").eq("id", input.id).maybeSingle();
        if (existing.data) return mapActivityCategory(existing.data);
      }
      if (error) throw error;
      return mapActivityCategory(data);
    },
    errors,
  );
}

export async function updateActivityCategory(raw: unknown): Promise<ActionResult<ActivityCategory>> {
  const parsed = updateCategorySchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const { id, name, color, isArchived } = parsed.data;

  return runAuthenticated(
    "activity_categories.update",
    async ({ supabase }) => {
      const { data, error } = await supabase
        .from("activity_categories")
        .update({ name, color, is_archived: isArchived })
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new ActionFailure({ code: "not_found", message: "This category no longer exists." });
      return mapActivityCategory(data);
    },
    errors,
  );
}

export async function deleteActivityCategory(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = deleteCategorySchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const { id, replacementId } = parsed.data;

  return runAuthenticated(
    "activity_categories.delete",
    async ({ supabase }) => {
      const { error } = await supabase.rpc("delete_activity_category", {
        p_category_id: id,
        ...(replacementId ? { p_replacement_id: replacementId } : {}),
      });
      if (error) throw error;
      return { id };
    },
    errors,
  );
}

export async function createFinanceCategory(raw: unknown): Promise<ActionResult<FinanceCategory>> {
  const parsed = createFinanceCategorySchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const input = parsed.data;

  return runAuthenticated(
    "finance_categories.create",
    async ({ supabase, user }) => {
      const sortOrder = await nextSortOrder(
        supabase
          .from("finance_categories")
          .select("sort_order")
          .eq("kind", input.kind)
          .order("sort_order", { ascending: false })
          .limit(1),
      );
      const { data, error } = await supabase
        .from("finance_categories")
        .insert({
          id: input.id,
          user_id: user.id,
          kind: input.kind,
          name: input.name,
          color: input.color,
          sort_order: sortOrder,
        })
        .select()
        .single();
      if (error && isUniqueViolation(error)) {
        const existing = await supabase.from("finance_categories").select("*").eq("id", input.id).maybeSingle();
        if (existing.data) return mapFinanceCategory(existing.data);
      }
      if (error) throw error;
      return mapFinanceCategory(data);
    },
    errors,
  );
}

export async function updateFinanceCategory(raw: unknown): Promise<ActionResult<FinanceCategory>> {
  const parsed = updateCategorySchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const { id, name, color, isArchived } = parsed.data;

  return runAuthenticated(
    "finance_categories.update",
    async ({ supabase }) => {
      const { data, error } = await supabase
        .from("finance_categories")
        .update({ name, color, is_archived: isArchived })
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new ActionFailure({ code: "not_found", message: "This category no longer exists." });
      return mapFinanceCategory(data);
    },
    errors,
  );
}

export async function deleteFinanceCategory(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = deleteCategorySchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const { id, replacementId } = parsed.data;

  return runAuthenticated(
    "finance_categories.delete",
    async ({ supabase }) => {
      const { error } = await supabase.rpc("delete_finance_category", {
        p_category_id: id,
        ...(replacementId ? { p_replacement_id: replacementId } : {}),
      });
      if (error) throw error;
      return { id };
    },
    errors,
  );
}
