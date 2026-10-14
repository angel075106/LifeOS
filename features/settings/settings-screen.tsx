"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Download, KeyRound, LogOut, MapPin } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/feedback";
import { Field, FormError } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import { useProfile, useSession } from "@/features/app/session";
import { useHydrated } from "@/features/app/sync-store";
import { useSignOut } from "@/features/app/use-sign-out";
import {
  createActivityCategory,
  createFinanceCategory,
  deleteActivityCategory,
  deleteFinanceCategory,
  updateActivityCategory,
  updateFinanceCategory,
} from "@/features/categories/actions";
import { useActivityCategories, useFinanceCategories } from "@/features/data/hooks";
import { describeMutationError, useActionMutation } from "@/features/data/mutations";
import { deviceTimeZone, isValidLocalDate, todayInZone } from "@/lib/dates";
import { toAppError } from "@/lib/errors";
import { CURRENCIES } from "@/lib/money";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { updateProfile } from "./actions";
import { CategoryManager, type CategoryApi } from "./category-manager";
import { InstallGuide } from "./install-guide";
import { profileFormSchema, type ProfileFormValues, type ProfileInput } from "./schema";

export function SettingsScreen() {
  const hydrated = useHydrated();
  if (!hydrated) return <Skeleton className="h-[70dvh]" />;
  return <SettingsContent />;
}

function SettingsContent() {
  return (
    <>
      <PageHeader eyebrow="System" title="Settings" description="Preferences, categories, data export and account." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Preferences" index="01" id="preferences">
          <PreferencesForm />
        </Panel>
        <Panel title="Account" index="02" id="account">
          <AccountSection />
        </Panel>
        <Panel title="Activity categories" index="03" id="activity-categories">
          <ActivityCategories />
        </Panel>
        <Panel title="Finance categories" index="04" id="finance-categories">
          <FinanceCategories />
        </Panel>
        <Panel title="Export data" index="05" id="export">
          <ExportSection />
        </Panel>
        <Panel title="Install LifeOS" index="06" id="install">
          <InstallGuide />
        </Panel>
      </div>
    </>
  );
}

function timeZoneOptions(current: string): string[] {
  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    zones = ["UTC", "Europe/Sofia", "Europe/London", "Europe/Berlin", "America/New_York"];
  }
  return Array.from(new Set(["UTC", current, ...zones])).sort((a, b) => (a === "UTC" ? -1 : b === "UTC" ? 1 : a.localeCompare(b)));
}

function PreferencesForm() {
  const profile = useProfile();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const save = useActionMutation(updateProfile, ["profiles"]);
  const device = deviceTimeZone();
  const zones = useMemo(() => timeZoneOptions(profile.timezone), [profile.timezone]);

  const form = useForm<ProfileFormValues, unknown, ProfileInput>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: profile.displayName ?? "",
      currency: profile.currency,
      timezone: profile.timezone,
      defaultCalendarView: profile.defaultCalendarView,
      weekStartsOn: profile.weekStartsOn,
    },
  });
  const { register, handleSubmit, formState, setValue, control } = form;
  const timezone = useWatch({ control, name: "timezone" });

  async function onSubmit(values: ProfileInput) {
    setFormError(null);
    try {
      const saved = await save.mutateAsync(values);
      queryClient.setQueryData(queryKeys.profile, saved);
      form.reset({
        displayName: saved.displayName ?? "",
        currency: saved.currency,
        timezone: saved.timezone,
        defaultCalendarView: saved.defaultCalendarView,
        weekStartsOn: saved.weekStartsOn,
      });
      toast.success("Preferences saved");
    } catch (caught) {
      setFormError(describeMutationError(caught).message);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
      <fieldset disabled={save.isPending} className="grid gap-4">
        <Field id="pref-name" label="Display name" error={formState.errors.displayName?.message}>
          {(control) => <Input {...control} {...register("displayName")} autoComplete="nickname" maxLength={80} placeholder="Optional" />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="pref-currency" label="Default currency" hint="Preselected for new transactions and budgets.">
            {(control) => (
              <Select {...control} {...register("currency")}>
                {CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency === "EUR" ? "EUR — Euro" : "BGN — Bulgarian lev"}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field id="pref-view" label="Default calendar view">
            {(control) => (
              <Select {...control} {...register("defaultCalendarView")}>
                <option value="month">Month</option>
                <option value="week">Week</option>
                <option value="day">Day</option>
              </Select>
            )}
          </Field>
          <Field id="pref-week-start" label="Week starts on">
            {(control) => (
              <Select {...control} {...register("weekStartsOn", { valueAsNumber: true })}>
                <option value={1}>Monday</option>
                <option value={0}>Sunday</option>
              </Select>
            )}
          </Field>
          <Field
            id="pref-timezone"
            label="Time zone"
            error={formState.errors.timezone?.message}
            hint="Activities are shown in this zone. Changing it shifts their displayed times; transaction dates never change."
          >
            {(control) => (
              <Select {...control} {...register("timezone")}>
                {zones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone.replace(/_/g, " ")}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        {timezone !== device ? (
          <button
            type="button"
            onClick={() => setValue("timezone", device, { shouldDirty: true, shouldValidate: true })}
            className="inline-flex items-center gap-1.5 justify-self-start text-xs text-cyan underline-offset-4 hover:underline"
          >
            <MapPin className="size-3.5" aria-hidden="true" />
            Use this device&apos;s time zone ({device.replace(/_/g, " ")})
          </button>
        ) : null}
      </fieldset>
      <FormError message={formError} />
      <Button type="submit" variant="primary" loading={save.isPending} disabled={!formState.isDirty} className="justify-self-start">
        Save preferences
      </Button>
    </form>
  );
}

function ActivityCategories() {
  const query = useActivityCategories();
  const create = useActionMutation(createActivityCategory, ["activity_categories"]);
  const update = useActionMutation(updateActivityCategory, ["activity_categories"]);
  const remove = useActionMutation(deleteActivityCategory, ["activity_categories", "activities"]);
  const api: CategoryApi = {
    create: (input) => create.mutateAsync(input),
    update: (input) => update.mutateAsync(input),
    remove: (input) => remove.mutateAsync(input),
    pending: create.isPending || update.isPending || remove.isPending,
  };
  return (
    <CategoryManager
      idPrefix="activity"
      noun="activity"
      entriesLabel="activities"
      categories={query.data}
      loading={query.isPending}
      error={query.error ? toAppError(query.error).message : null}
      onRetry={() => void query.refetch()}
      api={api}
    />
  );
}

function FinanceCategories() {
  const query = useFinanceCategories();
  const create = useActionMutation(createFinanceCategory, ["finance_categories"]);
  const update = useActionMutation(updateFinanceCategory, ["finance_categories"]);
  const remove = useActionMutation(deleteFinanceCategory, ["finance_categories", "transactions", "budgets"]);
  const pending = create.isPending || update.isPending || remove.isPending;

  const section = (kind: "income" | "expense") => {
    const api: CategoryApi = {
      create: (input) => create.mutateAsync({ ...input, kind }),
      update: (input) => update.mutateAsync(input),
      remove: (input) => remove.mutateAsync(input),
      pending,
    };
    return (
      <section aria-labelledby={`finance-${kind}-heading`} className="grid gap-2">
        <h3 id={`finance-${kind}-heading`} className="hud-label">
          {kind === "income" ? "Income" : "Expenses"}
        </h3>
        <CategoryManager
          idPrefix={`finance-${kind}`}
          noun={kind}
          entriesLabel="transactions"
          categories={query.data?.filter((category) => category.kind === kind)}
          loading={query.isPending}
          error={query.error ? toAppError(query.error).message : null}
          onRetry={() => void query.refetch()}
          api={api}
        />
      </section>
    );
  };

  return (
    <div className="grid gap-6">
      {section("expense")}
      {section("income")}
    </div>
  );
}

function ExportSection() {
  const profile = useProfile();
  const today = todayInZone(profile.timezone);
  const [from, setFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [to, setTo] = useState(today);
  const valid = isValidLocalDate(from) && isValidLocalDate(to) && from <= to;
  const query = valid ? `?from=${from}&to=${to}` : "";

  return (
    <div className="grid gap-4">
      <p className="text-sm text-fg-muted">
        Download your records as CSV (UTF-8) for spreadsheets or backups. Text that could run as a spreadsheet formula is
        neutralized. Activities include local times in your time zone ({profile.timezone}) and UTC.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="export-from">From</Label>
          <Input id="export-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="w-40" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="export-to">To</Label>
          <Input id="export-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} className="w-40" />
        </div>
      </div>
      {!valid ? <p className="text-xs text-warn">Choose a start date on or before the end date.</p> : null}
      <div className="flex flex-wrap gap-2">
        <a
          href={`/api/export/transactions${query}`}
          download
          aria-disabled={!valid}
          className={cn(buttonVariants({ variant: "secondary" }), !valid && "pointer-events-none opacity-50")}
        >
          <Download aria-hidden="true" />
          Transactions CSV
        </a>
        <a
          href={`/api/export/activities${query}`}
          download
          aria-disabled={!valid}
          className={cn(buttonVariants({ variant: "secondary" }), !valid && "pointer-events-none opacity-50")}
        >
          <Download aria-hidden="true" />
          Activities CSV
        </a>
      </div>
    </div>
  );
}

function AccountSection() {
  const { email } = useSession();
  const { signOut, pending } = useSignOut();
  const [confirmGlobal, setConfirmGlobal] = useState(false);

  return (
    <div className="grid gap-4">
      <dl className="grid gap-1">
        <dt className="hud-label">Signed in as</dt>
        <dd className="break-all text-sm text-fg">{email ?? "Unknown"}</dd>
      </dl>
      <div className="flex flex-wrap gap-2">
        <Link href="/auth/update-password" className={buttonVariants({ variant: "secondary" })}>
          <KeyRound aria-hidden="true" />
          Change password
        </Link>
        <Button variant="secondary" onClick={() => void signOut("local")} loading={pending}>
          {!pending ? <LogOut aria-hidden="true" /> : null}
          Sign out
        </Button>
        <Button variant="danger" onClick={() => setConfirmGlobal(true)} disabled={pending}>
          Sign out everywhere
        </Button>
      </div>
      <p className="text-xs text-fg-subtle">
        &ldquo;Sign out&rdquo; ends the session on this device only. &ldquo;Sign out everywhere&rdquo; also ends it on your other
        devices (they are signed out when their current access token expires, within about an hour).
      </p>
      <ConfirmDialog
        open={confirmGlobal}
        onOpenChange={setConfirmGlobal}
        title="Sign out on all devices?"
        confirmLabel="Sign out everywhere"
        description="Every device signed in to LifeOS will need to sign in again."
        onConfirm={async () => signOut("global")}
      />
    </div>
  );
}
