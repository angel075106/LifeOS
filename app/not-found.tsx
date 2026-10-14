import Link from "next/link";
import { Wordmark } from "@/components/domain/logo";
import { Panel } from "@/components/ui/panel";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4">
      <Wordmark />
      <Panel title="Page not found" index="404">
        <p className="text-sm text-fg-muted">This page doesn&apos;t exist.</p>
        <Link href="/calendar" className="mt-4 inline-block text-sm text-cyan underline-offset-4 hover:underline">
          Go to the calendar
        </Link>
      </Panel>
    </main>
  );
}
