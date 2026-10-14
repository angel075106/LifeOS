import { MailCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-shared";

export const metadata: Metadata = { title: "Confirm your email" };

export default function Page() {
  return (
    <AuthCard title="Confirm your email">
      <div className="grid gap-3 text-sm text-fg-muted">
        <MailCheck className="size-6 text-accent-text" aria-hidden="true" />
        <p>We sent a confirmation link to your inbox. Open it to activate your account.</p>
        <p>
          Opening the link in this browser signs you in automatically. If you open it on another device, your email is
          still confirmed: just sign in here.
        </p>
        <Link href="/auth/login" className="font-medium text-accent-text underline-offset-4 hover:underline">
          Go to sign in
        </Link>
      </div>
    </AuthCard>
  );
}
