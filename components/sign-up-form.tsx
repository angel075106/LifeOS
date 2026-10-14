"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AuthCard,
  ConfigMissingNotice,
  PASSWORD_MIN_LENGTH,
  authErrorMessage,
  isSupabaseConfigured,
} from "@/components/auth/auth-shared";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { deviceTimeZone } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";

export function SignUpForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isSupabaseConfigured()) return <ConfigMissingNotice />;

  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading) return;
    setError(null);
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Use at least ${PASSWORD_MIN_LENGTH} characters for your password.`);
      return;
    }
    if (password !== repeatPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error: signUpError } = await createClient().auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/calendar`,
          // Seeds the profile's time zone (see the new-user database trigger).
          data: { timezone: deviceTimeZone() },
        },
      });
      if (signUpError) throw signUpError;
      // With email confirmation disabled, Supabase signs the user in immediately.
      if (data.session) {
        router.replace("/calendar");
        router.refresh();
      } else {
        router.push("/auth/sign-up-success");
      }
    } catch (caught: unknown) {
      setError(authErrorMessage(caught));
      setIsLoading(false);
    }
  };

  return (
    <AuthCard title="Create account">
      <form onSubmit={handleSignUp} className="grid gap-4">
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
        <Field id="password" label="Password" required hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}>
          {(control) => (
            <Input
              {...control}
              type="password"
              autoComplete="new-password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </Field>
        <Field id="repeat-password" label="Repeat password" required>
          {(control) => (
            <Input
              {...control}
              type="password"
              autoComplete="new-password"
              required
              value={repeatPassword}
              onChange={(event) => setRepeatPassword(event.target.value)}
            />
          )}
        </Field>
        <FormError message={error} />
        <Button type="submit" variant="primary" size="lg" loading={isLoading} className="w-full">
          {isLoading ? "Creating account…" : "Create account"}
        </Button>
        <p className="text-center text-sm text-fg-muted">
          Already have an account?{" "}
          <Link href="/auth/login" className="font-medium text-accent-text underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
