"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

type DialogContentProps = React.ComponentProps<typeof DialogPrimitive.Content> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Small mono label above the title, e.g. "NEW ENTRY". */
  eyebrow?: string;
  /** Prevents closing (overlay click, Escape, close button) while a save is in flight. */
  busy?: boolean;
};

/**
 * Modal dialog: a bottom sheet on phones, a centered panel on larger screens.
 * Radix handles focus trapping, Escape, scroll locking and ARIA wiring.
 */
function DialogContent({
  title,
  description,
  eyebrow,
  busy = false,
  className,
  children,
  onEscapeKeyDown,
  onPointerDownOutside,
  onInteractOutside,
  ...props
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-void/80 backdrop-blur-[2px] data-[state=open]:animate-hud-fade" />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-xl border border-line-strong bg-panel shadow-2xl shadow-black/60 data-[state=open]:animate-hud-sheet",
          "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[88dvh] sm:w-[calc(100%-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:data-[state=open]:animate-hud-rise",
          className,
        )}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
          onEscapeKeyDown?.(event);
        }}
        onPointerDownOutside={(event) => {
          if (busy) event.preventDefault();
          onPointerDownOutside?.(event);
        }}
        onInteractOutside={(event) => {
          if (busy) event.preventDefault();
          onInteractOutside?.(event);
        }}
        {...props}
      >
        <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan/70 to-transparent" aria-hidden="true" />
        <div className="flex items-start gap-3 border-b border-line px-5 pb-3 pt-4">
          <div className="min-w-0 flex-1">
            {eyebrow ? <p className="hud-label mb-1 text-cyan">{eyebrow}</p> : null}
            <DialogPrimitive.Title className="text-base font-semibold text-fg">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-sm text-fg-muted">{description}</DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close
            disabled={busy}
            className="-mr-1 inline-flex size-9 items-center justify-center rounded-hud text-fg-muted transition-colors hover:bg-panel-hover hover:text-fg disabled:opacity-40"
            aria-label="Close"
          >
            <X className="size-4" aria-hidden="true" />
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          {children}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export { Dialog, DialogClose, DialogContent, DialogTrigger };
