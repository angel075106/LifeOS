"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AuthCard, ConfigMissingNotice, authErrorMessage, isSupabaseConfigured } from "@/components/auth/auth-shared";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (!isSupabaseConfigured()) return <ConfigMissingNotice />;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      // The redirect URL must be allowed in Supabase: Authentication > URL Configuration.
      const { error: resetError } = await createClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
      });
      if (resetError) throw resetError;
      setSuccess(true);
    } catch (caught: unknown) {
      setError(authErrorMessage(caught));
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <AuthCard title="Check your email">
        <div className="grid gap-3 text-sm text-fg-muted">
          <MailCheck className="size-6 text-accent-text" aria-hidden="true" />
          <p>If an account exists for that address, a password reset link is on its way.</p>
          <p>Open the link on this device and browser to choose a new password.</p>
          <Link href="/auth/login" className="font-medium text-accent-text underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Reset password">
      <form onSubmit={handleSubmit} className="grid gap-4">
        <p className="text-sm text-fg-muted">Enter your email and we&apos;ll send you a link to reset your password.</p>
        <Field id="email" label="Email" required>
          {(control) => (
            <Input
              {...control}
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          )}
        </Field>
        <FormError message={error} />
        <Button type="submit" variant="primary" size="lg" loading={isLoading} className="w-full">
          {isLoading ? "Sending…" : "Send reset link"}
        </Button>
        <Link href="/auth/login" className="text-center text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline">
          Back to sign in
        </Link>
      </form>
    </AuthCard>
  );
}
