"use client";

import { Archive, ArchiveRestore, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { CategoryChip } from "@/components/domain/display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Field, FormError } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { CATEGORY_PALETTE, categoryFormSchema } from "@/features/categories/schema";
import { describeMutationError } from "@/features/data/mutations";
import { newId } from "@/lib/utils";
import { ColorPicker } from "./color-picker";

export type ManagedCategory = { id: string; name: string; color: string; isArchived: boolean };

export type CategoryApi = {
  create: (input: { id: string; name: string; color: string }) => Promise<unknown>;
  update: (input: { id: string; name?: string; color?: string; isArchived?: boolean }) => Promise<unknown>;
  remove: (input: { id: string; replacementId: string | null }) => Promise<unknown>;
  pending: boolean;
};

type CategoryManagerProps = {
  idPrefix: string;
  noun: string;
  categories: ManagedCategory[] | undefined;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  api: CategoryApi;
  /** What existing entries are called, e.g. "activities" or "transactions". */
  entriesLabel: string;
};

export function CategoryManager({ idPrefix, noun, categories, loading, error, onRetry, api, entriesLabel }: CategoryManagerProps) {
  const toast = useToast();
  const [editing, setEditing] = useState<ManagedCategory | "new" | null>(null);
  const [deleting, setDeleting] = useState<ManagedCategory | null>(null);
  const [replacementId, setReplacementId] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const list = categories ?? [];
  const active = list.filter((category) => !category.isArchived);
  const archived = list.filter((category) => category.isArchived);

  async function toggleArchive(category: ManagedCategory) {
    try {
      await api.update({ id: category.id, isArchived: !category.isArchived });
      toast.success(category.isArchived ? `${category.name} restored` : `${category.name} archived`);
    } catch (caught) {
      toast.error("Couldn't update the category", describeMutationError(caught).message);
    }
  }

  const row = (category: ManagedCategory) => (
    <li key={category.id} className="flex flex-wrap items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-muted">
      <CategoryChip name={category.name} color={category.color} className="min-w-0 flex-1 text-sm text-fg" />
      {category.isArchived ? <Badge>Archived</Badge> : null}
      <div className="flex items-center gap-0.5">
        <Button variant="ghost" size="icon-sm" onClick={() => setEditing(category)} aria-label={`Edit ${category.name}`} title="Edit">
          <Pencil aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => void toggleArchive(category)}
          aria-label={category.isArchived ? `Restore ${category.name}` : `Archive ${category.name}`}
          title={category.isArchived ? "Restore" : "Archive"}
          disabled={api.pending}
        >
          {category.isArchived ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-expense hover:text-expense"
          onClick={() => {
            setReplacementId("");
            setDeleteError(null);
            setDeleting(category);
          }}
          aria-label={`Delete ${category.name}`}
          title="Delete"
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
    </li>
  );

  return (
    <div className="grid gap-3">
      {error ? <ErrorState message={error} onRetry={onRetry} /> : null}
      {loading ? (
        <Skeleton className="h-32 rounded-lg" />
      ) : list.length === 0 ? (
        <EmptyState title={`No ${noun} categories`} description="Create one to start organizing your entries." />
      ) : (
        <>
          <ul className="-mx-2.5 grid gap-0.5">{active.map(row)}</ul>
          {archived.length > 0 ? (
            <details className="group">
              <summary className="cursor-pointer rounded-md text-xs font-medium text-fg-muted hover:text-fg">
                Archived ({archived.length}) — hidden from pickers, kept on existing entries
              </summary>
              <ul className="-mx-2.5 mt-2 grid gap-0.5">{archived.map(row)}</ul>
            </details>
          ) : null}
        </>
      )}
      <Button variant="secondary" size="sm" className="justify-self-start" onClick={() => setEditing("new")}>
        <Plus aria-hidden="true" />
        Add {noun} category
      </Button>

      <CategoryDialog
        key={editing === "new" ? "new" : (editing?.id ?? "closed")}
        idPrefix={idPrefix}
        noun={noun}
        target={editing}
        onClose={() => setEditing(null)}
        api={api}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (!open ? setDeleting(null) : undefined)}
        title={`Delete ${deleting?.name ?? "category"}?`}
        description={
          <>
            If any {entriesLabel} use this category, choose a replacement to move them to. Otherwise the deletion is
            refused and nothing changes. Archiving is the safer alternative.
          </>
        }
        onConfirm={async () => {
          if (!deleting) return false;
          setDeleteError(null);
          try {
            await api.remove({ id: deleting.id, replacementId: replacementId || null });
            toast.success(`${deleting.name} deleted`);
            return true;
          } catch (caught) {
            setDeleteError(describeMutationError(caught).message);
            return false;
          }
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-replacement`}>Move existing {entriesLabel} to</Label>
          <Select id={`${idPrefix}-replacement`} value={replacementId} onChange={(event) => setReplacementId(event.target.value)}>
            <option value="">No replacement (only if unused)</option>
            {list
              .filter((category) => category.id !== deleting?.id)
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {category.isArchived ? " (archived)" : ""}
                </option>
              ))}
          </Select>
          <FormError message={deleteError} className="mt-2" />
        </div>
      </ConfirmDialog>
    </div>
  );
}

function CategoryDialog({
  idPrefix,
  noun,
  target,
  onClose,
  api,
}: {
  idPrefix: string;
  noun: string;
  target: ManagedCategory | "new" | null;
  onClose: () => void;
  api: CategoryApi;
}) {
  const toast = useToast();
  const editing = target !== "new" && target !== null ? target : null;
  const [recordId] = useState(() => newId());
  const [name, setName] = useState(editing?.name ?? "");
  const [color, setColor] = useState(editing?.color ?? CATEGORY_PALETTE[0]);
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const parsed = categoryFormSchema.safeParse({ name, color });
    if (!parsed.success) {
      setNameError(parsed.error.issues.find((issue) => issue.path[0] === "name")?.message ?? null);
      return;
    }
    setNameError(null);
    setFormError(null);
    setSaving(true);
    try {
      if (editing) await api.update({ id: editing.id, ...parsed.data });
      else await api.create({ id: recordId, ...parsed.data });
      toast.success(editing ? "Category updated" : "Category created", parsed.data.name);
      onClose();
    } catch (caught) {
      setFormError(describeMutationError(caught).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => (!open && !saving ? onClose() : undefined)}>
      {target !== null ? (
        <DialogContent title={editing ? `Edit ${noun} category` : `New ${noun} category`} busy={saving}>
          <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
            <Field id={`${idPrefix}-category-name`} label="Name" required error={nameError ?? undefined}>
              {(control) => (
                <Input {...control} value={name} onChange={(event) => setName(event.target.value)} maxLength={40} autoComplete="off" disabled={saving} />
              )}
            </Field>
            <div className="grid gap-1.5">
              <span className="text-[13px] font-medium text-fg">Color</span>
              <ColorPicker id={`${idPrefix}-category-color`} value={color} onChange={setColor} disabled={saving} />
            </div>
            <FormError message={formError} />
            <Button type="submit" variant="primary" loading={saving} className="sm:justify-self-end">
              {editing ? "Save category" : "Create category"}
            </Button>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
