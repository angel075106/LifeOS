"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { mapBudget, mapTransaction } from "@/lib/data/mappers";
import {
  ActionFailure,
  CONFLICT_MESSAGE,
  invalidInput,
  isUniqueViolation,
  runAuthenticated,
} from "@/lib/server-action";
import type { Budget, Transaction } from "@/lib/types";
import {
  copyBudgetsInputSchema,
  createTransactionInputSchema,
  setBudgetInputSchema,
  updateTransactionInputSchema,
} from "./schema";

export async function createTransaction(raw: unknown): Promise<ActionResult<Transaction>> {
  const parsed = createTransactionInputSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const input = parsed.data;

  return runAuthenticated("transactions.create", async ({ supabase, user }) => {
    const fields = {
      type: input.type,
      amount_minor: input.amountMinor,
      currency: input.currency,
      occurred_on: input.occurredOn,
      category_id: input.categoryId,
      description: input.description,
    };
    const { data, error } = await supabase
      .from("transactions")
      .insert({ id: input.id, user_id: user.id, ...fields })
      .select()
      .single();

    if (error && isUniqueViolation(error)) {
      // Same client-generated id: an earlier attempt of this submission already created the
      // row (double tap / retry after timeout). Apply the latest values; RLS scopes this to
      // the caller's own row.
      const retried = await supabase.from("transactions").update(fields).eq("id", input.id).select().maybeSingle();
      if (retried.error) throw retried.error;
      if (retried.data) return mapTransaction(retried.data);
    }
    if (error) throw error;
    return mapTransaction(data);
  });
}

export async function updateTransaction(raw: unknown): Promise<ActionResult<Transaction>> {
  const parsed = updateTransactionInputSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const input = parsed.data;

  return runAuthenticated("transactions.update", async ({ supabase }) => {
    const { data, error } = await supabase
      .from("transactions")
      .update({
        type: input.type,
        amount_minor: input.amountMinor,
        currency: input.currency,
        occurred_on: input.occurredOn,
        category_id: input.categoryId,
        description: input.description,
      })
      .eq("id", input.id)
      .eq("updated_at", input.expectedUpdatedAt)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (data) return mapTransaction(data);

    const current = await supabase.from("transactions").select("id").eq("id", input.id).maybeSingle();
    if (current.error) throw current.error;
    throw new ActionFailure(
      current.data
        ? { code: "conflict", message: CONFLICT_MESSAGE }
        : { code: "not_found", message: "This transaction no longer exists. It may have been deleted on another device." },
    );
  });
}

export async function deleteTransaction(raw: unknown): Promise<ActionResult<{ id: string; alreadyDeleted: boolean }>> {
  const parsed = z.object({ id: z.uuid() }).safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const { id } = parsed.data;

  return runAuthenticated("transactions.delete", async ({ supabase }) => {
    const { data, error } = await supabase.from("transactions").delete().eq("id", id).select("id");
    if (error) throw error;
    return { id, alreadyDeleted: (data ?? []).length === 0 };
  });
}

export async function setBudget(raw: unknown): Promise<ActionResult<Budget>> {
  const parsed = setBudgetInputSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const input = parsed.data;

  return runAuthenticated("budgets.set", async ({ supabase }) => {
    const { data, error } = await supabase
      .rpc("upsert_budget", {
        p_category_id: input.categoryId,
        p_month: input.month,
        p_currency: input.currency,
        p_amount_minor: input.amountMinor,
      })
      .single();
    if (error) throw error;
    return mapBudget(data);
  });
}

export async function deleteBudget(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = z.object({ id: z.uuid() }).safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const { id } = parsed.data;

  return runAuthenticated("budgets.delete", async ({ supabase }) => {
    const { error } = await supabase.from("budgets").delete().eq("id", id);
    if (error) throw error;
    return { id };
  });
}

export async function copyBudgets(raw: unknown): Promise<ActionResult<{ copied: number }>> {
  const parsed = copyBudgetsInputSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const { fromMonth, toMonth } = parsed.data;

  return runAuthenticated("budgets.copy", async ({ supabase }) => {
    const { data, error } = await supabase.rpc("copy_budgets", { p_from_month: fromMonth, p_to_month: toMonth });
    if (error) throw error;
    return { copied: typeof data === "number" ? data : 0 };
  });
}
