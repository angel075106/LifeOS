"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDownRight, ArrowUpRight, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch, type Path } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useToast } from "@/components/ui/toast";
import { useProfile } from "@/features/app/session";
import { useOnline } from "@/features/app/sync-store";
import { useFinanceCategories } from "@/features/data/hooks";
import { describeMutationError, useActionMutation } from "@/features/data/mutations";
import { createTransaction, deleteTransaction, updateTransaction } from "@/features/finance/actions";
import {
  transactionFormSchema,
  type TransactionFormOutput,
  type TransactionFormValues,
} from "@/features/finance/schema";
import type { LocalDate } from "@/lib/dates";
import { CURRENCIES, formatMoney, minorToDecimalString } from "@/lib/money";
import type { Transaction, TransactionType } from "@/lib/types";
import { newId } from "@/lib/utils";

export type TransactionDialogState =
  | { mode: "create"; date: LocalDate; type: TransactionType }
  | { mode: "edit"; transaction: Transaction };

const SERVER_FIELD_MAP: Record<string, Path<TransactionFormValues>> = {
  type: "type",
  amountMinor: "amount",
  currency: "currency",
  occurredOn: "occurredOn",
  categoryId: "categoryId",
  description: "description",
};

export function TransactionDialog({
  state,
  onClose,
}: {
  state: TransactionDialogState | null;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const isEdit = state?.mode === "edit";
  return (
    <Dialog open={state !== null} onOpenChange={(open) => (!open && !busy ? onClose() : undefined)}>
      {state ? (
        <DialogContent
          title={isEdit ? "Edit transaction" : state.type === "income" ? "New income" : "New expense"}
          busy={busy}
        >
          <TransactionForm
            key={
              state.mode === "edit"
                ? `${state.transaction.id}:${state.transaction.updatedAt}`
                : `new:${state.date}:${state.type}`
            }
            state={state}
            onDone={onClose}
            onBusyChange={setBusy}
          />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function TransactionForm({
  state,
  onDone,
  onBusyChange,
}: {
  state: TransactionDialogState;
  onDone: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const profile = useProfile();
  const toast = useToast();
  const online = useOnline();
  const categoriesQuery = useFinanceCategories();
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);

  const [recordId] = useState(() => (state.mode === "edit" ? state.transaction.id : newId()));
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [defaults] = useState<TransactionFormValues>(() => {
    if (state.mode === "edit") {
      const { transaction } = state;
      return {
        type: transaction.type,
        amount: minorToDecimalString(transaction.amountMinor, transaction.currency),
        currency: transaction.currency,
        occurredOn: transaction.occurredOn,
        categoryId: transaction.categoryId,
        description: transaction.description ?? "",
      };
    }
    return {
      type: state.type,
      amount: "",
      currency: profile.currency,
      occurredOn: state.date,
      categoryId: categories.find((category) => category.kind === state.type && !category.isArchived)?.id ?? "",
      description: "",
    };
  });

  const form = useForm<TransactionFormValues, unknown, TransactionFormOutput>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: defaults,
    mode: "onTouched",
  });
  const { register, handleSubmit, formState, control, setValue, setError, getValues } = form;
  const type = useWatch({ control, name: "type" });

  const create = useActionMutation(createTransaction, ["transactions"]);
  const update = useActionMutation(updateTransaction, ["transactions"]);
  const remove = useActionMutation(deleteTransaction, ["transactions"]);
  const saving = create.isPending || update.isPending;

  const currentCategoryId = state.mode === "edit" ? state.transaction.categoryId : null;
  const options = categories.filter(
    (category) => category.kind === type && (!category.isArchived || category.id === currentCategoryId),
  );

  // Keep the category consistent with the type (and fill it once categories load).
  useEffect(() => {
    const selected = categories.find((category) => category.id === getValues("categoryId"));
    if (selected && selected.kind === type) return;
    const first = categories.find((category) => category.kind === type && !category.isArchived);
    setValue("categoryId", first?.id ?? "", { shouldValidate: formState.isSubmitted });
  }, [type, categories, getValues, setValue, formState.isSubmitted]);

  async function save(output: TransactionFormOutput) {
    setFormError(null);
    onBusyChange(true);
    try {
      const saved =
        state.mode === "edit"
          ? await update.mutateAsync({ ...output, id: recordId, expectedUpdatedAt: state.transaction.updatedAt })
          : await create.mutateAsync({ ...output, id: recordId });
      toast.success(
        state.mode === "edit" ? "Transaction updated" : saved.type === "income" ? "Income saved" : "Expense saved",
        formatMoney(saved.amountMinor, saved.currency),
      );
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
      const result = await remove.mutateAsync({ id: state.transaction.id });
      toast.success(result.alreadyDeleted ? "Transaction was already deleted" : "Transaction deleted");
      onDone();
      return true;
    } catch (error) {
      toast.error("Couldn't delete the transaction", describeMutationError(error).message);
      return false;
    } finally {
      onBusyChange(false);
    }
  }

  const noCategories = categoriesQuery.isSuccess && options.length === 0;

  return (
    <form noValidate onSubmit={handleSubmit(save)} className="grid gap-4" aria-busy={saving}>
      <fieldset disabled={saving} className="grid gap-4">
        <SegmentedControl
          label="Transaction type"
          value={type}
          onChange={(value) => setValue("type", value, { shouldDirty: true })}
          className="w-full"
          options={[
            {
              value: "expense",
              label: "Expense",
              icon: <ArrowDownRight aria-hidden="true" />,
              activeClassName: "border-expense/30 bg-expense-soft text-expense",
            },
            {
              value: "income",
              label: "Income",
              icon: <ArrowUpRight aria-hidden="true" />,
              activeClassName: "border-income/30 bg-income-soft text-income",
            },
          ]}
        />

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field id="transaction-amount" label="Amount" required error={formState.errors.amount?.message}>
            {(control) => (
              <Input
                {...control}
                {...register("amount")}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                className="tabular-nums"
                maxLength={20}
              />
            )}
          </Field>
          <Field id="transaction-currency" label="Currency" required error={formState.errors.currency?.message}>
            {(control) => (
              <Select {...control} {...register("currency")} className="w-24">
                {CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field id="transaction-date" label="Date" required error={formState.errors.occurredOn?.message}>
            {(control) => <Input {...control} type="date" {...register("occurredOn")} />}
          </Field>
          <Field id="transaction-category" label="Category" required error={formState.errors.categoryId?.message}>
            {(control) => (
              <Select {...control} {...register("categoryId")} disabled={!categoriesQuery.isSuccess}>
                <option value="" disabled>
                  {categoriesQuery.isPending ? "Loading…" : "Choose a category"}
                </option>
                {options.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                    {category.isArchived ? " (archived)" : ""}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        {noCategories ? (
          <p className="-mt-2 text-xs text-warning">
            No {type} categories yet.{" "}
            <Link href="/settings#finance-categories" className="font-medium text-accent-text underline-offset-4 hover:underline" onClick={onDone}>
              Create one in Settings
            </Link>
            .
          </p>
        ) : null}

        <Field
          id="transaction-description"
          label="Description or merchant"
          error={formState.errors.description?.message}
        >
          {(control) => (
            <Input {...control} {...register("description")} autoComplete="off" placeholder="Optional" maxLength={200} />
          )}
        </Field>
      </fieldset>

      <FormError message={formError} />
      {!online ? <p className="text-xs text-warning">You appear to be offline. Saving needs a connection.</p> : null}

      <div className="-mx-5 flex flex-col-reverse gap-2 border-t border-border px-5 pt-4 sm:flex-row sm:items-center">
        {state.mode === "edit" ? (
          <Button
            variant="ghost"
            className="text-expense hover:text-expense sm:mr-auto"
            onClick={() => setConfirmDelete(true)}
            disabled={saving || remove.isPending}
          >
            <Trash2 aria-hidden="true" />
            Delete
          </Button>
        ) : null}
        <Button
          type="submit"
          variant="primary"
          loading={saving}
          className="sm:ml-auto sm:min-w-36"
        >
          {state.mode === "edit" ? "Save changes" : type === "income" ? "Save income" : "Save expense"}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this transaction?"
        description={
          state.mode === "edit" ? (
            <>
              The {state.transaction.type} of{" "}
              <strong className="text-fg">
                {formatMoney(state.transaction.amountMinor, state.transaction.currency)}
              </strong>{" "}
              on {state.transaction.occurredOn} will be permanently deleted on all your devices.
            </>
          ) : null
        }
        onConfirm={handleDelete}
      />
    </form>
  );
}
