import { z } from "zod";
import { TRANSACTION_TYPES } from "@/lib/types";

export const CATEGORY_NAME_MAX = 40;

/** HUD-friendly palette offered when picking a category color. */
export const CATEGORY_PALETTE = [
  "#22d3ee",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#f97316",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#0ea5e9",
  "#94a3b8",
] as const;

export const categoryNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a name")
  .max(CATEGORY_NAME_MAX, `Keep the name under ${CATEGORY_NAME_MAX} characters`);

export const categoryColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Choose a color")
  .transform((value) => value.toLowerCase());

export const categoryFormSchema = z.object({ name: categoryNameSchema, color: categoryColorSchema });
export type CategoryFormValues = z.input<typeof categoryFormSchema>;

export const createActivityCategorySchema = categoryFormSchema.extend({ id: z.uuid() });
export const createFinanceCategorySchema = categoryFormSchema.extend({
  id: z.uuid(),
  kind: z.enum(TRANSACTION_TYPES),
});

export const updateCategorySchema = z
  .object({
    id: z.uuid(),
    name: categoryNameSchema.optional(),
    color: categoryColorSchema.optional(),
    isArchived: z.boolean().optional(),
  })
  .refine(
    (value) => value.name !== undefined || value.color !== undefined || value.isArchived !== undefined,
    "Nothing to update",
  );

export const deleteCategorySchema = z.object({
  id: z.uuid(),
  replacementId: z.uuid().nullable(),
});
