"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ConfigMissingNotice, authErrorMessage, isSupabaseConfigured } from "@/components/auth/auth-shared";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isSupabaseConfigured()) return <ConfigMissingNotice />;

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const { error: signInError } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) throw signInError;
      router.replace(safeRedirectPath(searchParams.get("next"), window.location.origin));
      router.refresh();
    } catch (caught: unknown) {
      setError(authErrorMessage(caught));
      setIsLoading(false);
    }
  };

  return (
    <Panel title="Sign in" index="01">
      <form onSubmit={handleLogin} className="grid gap-4">
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
        <Field id="password" label="Password" required>
          {(control) => (
            <Input
              {...control}
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </Field>
        <FormError message={error} />
        <Button type="submit" variant="solid" size="lg" loading={isLoading} className="w-full">
          {isLoading ? "Signing in…" : "Sign in"}
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <Link href="/auth/forgot-password" className="text-fg-muted underline-offset-4 hover:text-fg hover:underline">
            Forgot password?
          </Link>
          <Link href="/auth/sign-up" className="text-cyan underline-offset-4 hover:underline">
            Create an account
          </Link>
        </div>
      </form>
    </Panel>
  );
}
