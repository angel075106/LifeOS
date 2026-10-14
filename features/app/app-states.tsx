import { Database, TriangleAlert } from "lucide-react";
import { Wordmark } from "@/components/domain/logo";
import { Skeleton } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/panel";
import { PlainSignOutButton } from "./plain-sign-out-button";

/** Static loading shell (prerendered; contains no user data). */
export function AppShellSkeleton() {
  return (
    <div className="min-h-dvh md:pl-60" aria-busy="true">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-base/90 md:flex">
        <div className="flex h-16 items-center border-b border-line px-5">
          <Wordmark />
        </div>
        <div className="grid gap-2 p-4">
          <Skeleton className="h-10" />
          <Skeleton className="mt-4 h-8" />
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
      </aside>
      <header className="flex h-14 items-center border-b border-line px-4 md:hidden">
        <Wordmark />
      </header>
      <div className="grid gap-4 px-4 py-6 md:px-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[60dvh]" />
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
        actions={reason === "schema" ? <Database className="size-4 text-warn" aria-hidden="true" /> : <TriangleAlert className="size-4 text-warn" aria-hidden="true" />}
      >
        {reason === "schema" ? (
          <div className="grid gap-3 text-sm text-fg-muted">
            <p>You are signed in, but the LifeOS tables were not found in your Supabase project.</p>
            <p>
              Apply the SQL migrations in <code className="font-mono text-cyan-soft">supabase/migrations</code> (in
              filename order) with <code className="font-mono text-cyan-soft">npx supabase db push</code> or the
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
          <a
            href="/calendar"
            className="inline-flex h-10 items-center rounded-hud border border-cyan/60 bg-cyan/12 px-4 text-sm font-medium text-cyan-soft hover:bg-cyan/20"
          >
            Reload
          </a>
          <PlainSignOutButton />
        </div>
      </Panel>
    </main>
  );
}
