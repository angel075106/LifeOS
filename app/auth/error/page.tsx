import { TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Panel } from "@/components/ui/panel";

export const metadata: Metadata = { title: "Sign-in problem" };

/**
 * Only known reason codes are rendered. Arbitrary text from the URL is never displayed, so
 * crafted links cannot put misleading messages on this page.
 */
const MESSAGES: Record<string, string> = {
  invalid_link: "This link is invalid or incomplete. Request a new one and try again.",
  link_expired: "This link has expired or was already used. Request a new one and try again.",
  exchange_failed:
    "We couldn't finish signing you in from this link. If you opened it in a different browser or device than the one you started on, your email is probably confirmed already: just sign in.",
};

const FALLBACK = "Something went wrong while signing you in. Please try again.";

async function Message({ searchParams }: { searchParams: Promise<{ reason?: string | string[] }> }) {
  const { reason } = await searchParams;
  const key = typeof reason === "string" ? reason : "";
  return <p className="text-sm text-fg-muted">{MESSAGES[key] ?? FALLBACK}</p>;
}

export default function Page({ searchParams }: { searchParams: Promise<{ reason?: string | string[] }> }) {
  return (
    <Panel title="Sign-in problem" index="!" actions={<TriangleAlert className="size-4 text-warn" aria-hidden="true" />}>
      <div className="grid gap-4">
        <Suspense fallback={<p className="text-sm text-fg-muted">{FALLBACK}</p>}>
          <Message searchParams={searchParams} />
        </Suspense>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/auth/login" className="text-cyan underline-offset-4 hover:underline">
            Sign in
          </Link>
          <Link href="/auth/forgot-password" className="text-fg-muted underline-offset-4 hover:text-fg hover:underline">
            Reset password
          </Link>
        </div>
      </div>
    </Panel>
  );
}
