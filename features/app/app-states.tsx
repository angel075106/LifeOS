import { Database, TriangleAlert } from "lucide-react";
import { Wordmark } from "@/components/domain/logo";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/panel";
import { PlainSignOutButton } from "./plain-sign-out-button";

/** Static loading shell (prerendered; contains no user data). */
export function AppShellSkeleton() {
  return (
    <div className="min-h-dvh md:pl-60" aria-busy="true">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-border bg-canvas md:flex">
        <div className="flex h-14 items-center px-4">
          <Wordmark />
        </div>
        <div className="grid gap-1.5 px-3 pt-1">
          <Skeleton className="h-9 rounded-lg" />
          <Skeleton className="mt-5 h-8 rounded-lg" />
          <Skeleton className="h-8 rounded-lg" />
          <Skeleton className="h-8 rounded-lg" />
          <Skeleton className="h-8 rounded-lg" />
          <Skeleton className="h-8 rounded-lg" />
        </div>
      </aside>
      <header className="flex h-14 items-center border-b border-border px-4 md:hidden">
        <Wordmark />
      </header>
      <div className="mx-auto grid w-full max-w-[1440px] gap-4 px-4 py-6 md:px-8 md:pt-7">
        <Skeleton className="h-8 w-56 rounded-lg" />
        <Skeleton className="h-[60dvh] rounded-xl" />
      </div>
      <p className="sr-only" role="status">
        Loading LifeOS…
      </p>
    </div>
  );
}

/** Shown when the user is signed in but the database is not ready. */
export function SetupRequired({ reason }: { reason: "schema" | "profile" }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-4 py-10">
      <Wordmark />
      <Panel
        title={reason === "schema" ? "Database setup required" : "Couldn't load your profile"}
        actions={reason === "schema" ? <Database className="size-4 text-warning" aria-hidden="true" /> : <TriangleAlert className="size-4 text-warning" aria-hidden="true" />}
      >
        {reason === "schema" ? (
          <div className="grid gap-3 text-sm text-fg-muted">
            <p>You are signed in, but the LifeOS tables were not found in your Supabase project.</p>
            <p>
              Apply the SQL migrations in <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px] text-fg">supabase/migrations</code> (in
              filename order) with <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px] text-fg">npx supabase db push</code> or the
              Supabase SQL Editor, then reload this page. See the README for step-by-step instructions.
            </p>
          </div>
        ) : (
          <p className="text-sm text-fg-muted">
            LifeOS could not load or create your profile. Check your connection and reload. If this keeps happening,
            make sure all database migrations have been applied.
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <a href="/calendar" className={buttonVariants({ variant: "primary" })}>
            Reload
          </a>
          <PlainSignOutButton />
        </div>
      </Panel>
    </main>
  );
}
