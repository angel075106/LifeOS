import { z } from "zod";
import { isValidLocalDate } from "@/lib/dates";
import { CURRENCIES, MAX_AMOUNT_MINOR, parseAmountToMinor } from "@/lib/money";
import { TRANSACTION_TYPES } from "@/lib/types";

export const DESCRIPTION_MAX = 200;
const MIN_DATE = "1970-01-01";
const MAX_DATE = "2199-12-31";

const dateSchema = z
  .string()
  .refine(isValidLocalDate, "Enter a valid date")
  .refine((value) => value >= MIN_DATE && value <= MAX_DATE, "Choose a date between 1970 and 2199");

const descriptionSchema = z
  .string()
  .max(DESCRIPTION_MAX, `Keep the description under ${DESCRIPTION_MAX} characters`)
  .transform((value) => {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  });

const amountMinorSchema = z
  .number()
  .int("Amount must be a whole number of cents")
  .min(1, "Amount must be greater than zero")
  .max(MAX_AMOUNT_MINOR, "Amount is too large");

// ---------------------------------------------------------------------------
// Server-side inputs
// ---------------------------------------------------------------------------

const transactionFieldsSchema = z.object({
  type: z.enum(TRANSACTION_TYPES),
  amountMinor: amountMinorSchema,
  currency: z.enum(CURRENCIES),
  occurredOn: dateSchema,
  categoryId: z.uuid("Choose a category"),
  description: z.union([descriptionSchema, z.null()]),
});

export const createTransactionInputSchema = transactionFieldsSchema.extend({ id: z.uuid() });
export const updateTransactionInputSchema = transactionFieldsSchema.extend({
  id: z.uuid(),
  expectedUpdatedAt: z.string().min(1),
});

export type CreateTransactionInput = z.input<typeof createTransactionInputSchema>;
export type UpdateTransactionInput = z.input<typeof updateTransactionInputSchema>;

export const budgetMonthSchema = z
  .string()
  .refine((value) => isValidLocalDate(value) && value.endsWith("-01"), "Invalid month")
  .refine((value) => value >= MIN_DATE && value <= "2199-12-01", "Invalid month");

export const setBudgetInputSchema = z.object({
  categoryId: z.uuid("Choose a category"),
  month: budgetMonthSchema,
  currency: z.enum(CURRENCIES),
  amountMinor: amountMinorSchema,
});

export const copyBudgetsInputSchema = z.object({ fromMonth: budgetMonthSchema, toMonth: budgetMonthSchema });

// ---------------------------------------------------------------------------
// Form schema (browser)
// ---------------------------------------------------------------------------

/** Amount text validated as typed (both supported currencies use 2 decimals). */
const amountTextSchema = z.string().superRefine((value, ctx) => {
  const parsed = parseAmountToMinor(value, "EUR");
  if (!parsed.ok) ctx.addIssue({ code: "custom", message: parsed.error });
});

export const transactionFormSchema = z
  .object({
    type: z.enum(TRANSACTION_TYPES),
    amount: amountTextSchema,
    currency: z.enum(CURRENCIES),
    occurredOn: dateSchema,
    categoryId: z.string().min(1, "Choose a category").pipe(z.uuid("Choose a category")),
    description: descriptionSchema,
  })
  .transform((value, ctx) => {
    const parsed = parseAmountToMinor(value.amount, value.currency);
    if (!parsed.ok) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: parsed.error });
      return z.NEVER;
    }
    return {
      type: value.type,
      amountMinor: parsed.minor,
      currency: value.currency,
      occurredOn: value.occurredOn,
      categoryId: value.categoryId,
      description: value.description,
    };
  });

export type TransactionFormValues = z.input<typeof transactionFormSchema>;
export type TransactionFormOutput = z.output<typeof transactionFormSchema>;

/** Budget amount entry: just the amount text. */
export const budgetAmountFormSchema = z.object({ amount: amountTextSchema });
