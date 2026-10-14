"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { Button } from "./button";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  /** Resolve true to close the dialog; false keeps it open (e.g. the action failed). */
  onConfirm: () => Promise<boolean>;
  children?: React.ReactNode;
};

/** Confirmation for destructive actions. Cannot be dismissed while the action runs. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    if (pending) return;
    setPending(true);
    try {
      const shouldClose = await onConfirm();
      if (shouldClose) onOpenChange(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => (!pending ? onOpenChange(next) : undefined)}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-void/85 data-[state=open]:animate-hud-fade" />
        <AlertDialog.Content
          className="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-expense/40 bg-panel p-5 shadow-2xl shadow-black/60 data-[state=open]:animate-hud-rise"
          onEscapeKeyDown={(event) => (pending ? event.preventDefault() : undefined)}
        >
          <div className="flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-expense/40 bg-expense/10 text-expense">
              <AlertTriangle className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <AlertDialog.Title className="text-base font-semibold text-fg">{title}</AlertDialog.Title>
              <AlertDialog.Description asChild>
                <div className="mt-1 text-sm text-fg-muted">{description}</div>
              </AlertDialog.Description>
            </div>
          </div>
          {children ? <div className="mt-4">{children}</div> : null}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost" disabled={pending}>
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <Button variant="danger" loading={pending} onClick={handleConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
