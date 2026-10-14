"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ConfigMissingNotice,
  PASSWORD_MIN_LENGTH,
  authErrorMessage,
  isSupabaseConfigured,
} from "@/components/auth/auth-shared";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { createClient } from "@/lib/supabase/client";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isSupabaseConfigured()) return <ConfigMissingNotice />;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
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
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setError("Your reset link has expired or was opened in another browser. Request a new link.");
        setIsLoading(false);
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      router.replace("/calendar");
      router.refresh();
    } catch (caught: unknown) {
      setError(authErrorMessage(caught));
      setIsLoading(false);
    }
  };

  return (
    <Panel title="Choose a new password" index="01">
      <form onSubmit={handleSubmit} className="grid gap-4">
        <Field id="password" label="New password" required hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}>
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
        <Field id="repeat-password" label="Repeat new password" required>
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
        <Button type="submit" variant="solid" size="lg" loading={isLoading} className="w-full">
          {isLoading ? "Saving…" : "Save new password"}
        </Button>
        <Link href="/auth/forgot-password" className="text-center text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline">
          Request a new link
        </Link>
      </form>
    </Panel>
  );
}
