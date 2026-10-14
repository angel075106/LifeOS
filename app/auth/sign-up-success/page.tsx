import { MailCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Panel } from "@/components/ui/panel";

export const metadata: Metadata = { title: "Confirm your email" };

export default function Page() {
  return (
    <Panel title="Confirm your email" index="01">
      <div className="grid gap-3 text-sm text-fg-muted">
        <MailCheck className="size-6 text-cyan" aria-hidden="true" />
        <p>We sent a confirmation link to your inbox. Open it to activate your account.</p>
        <p>
          Opening the link in this browser signs you in automatically. If you open it on another device, your email is
          still confirmed: just sign in here.
        </p>
        <Link href="/auth/login" className="text-cyan underline-offset-4 hover:underline">
          Go to sign in
        </Link>
      </div>
    </Panel>
  );
}
