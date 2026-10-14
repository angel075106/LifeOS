"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

/** Render-error boundary for the app area. Shows no internal details, only a reference code. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Log the digest only: it correlates with server logs without exposing data.
    console.error("[lifeos] screen failed to render", error.digest ?? "client");
  }, [error.digest]);

  return (
    <div className="mx-auto max-w-lg py-10">
      <Panel title="Something went wrong" actions={<TriangleAlert className="size-4 text-warn" aria-hidden="true" />}>
        <div className="grid gap-4 text-sm text-fg-muted">
          <p>This screen couldn&apos;t be displayed. Your saved data is not affected.</p>
          {error.digest ? <p className="font-mono text-xs text-fg-subtle">Reference: {error.digest}</p> : null}
          <div className="flex gap-2">
            <Button variant="primary" onClick={reset}>
              Try again
            </Button>
            {/* A full page load (not client navigation) to recover from a broken client state. */}
            <a href="/calendar" className={buttonVariants({ variant: "ghost" })}>
              Go to calendar
            </a>
          </div>
        </div>
      </Panel>
    </div>
  );
}
