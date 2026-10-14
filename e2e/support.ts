import { expect, type Page } from "@playwright/test";
import { readPublicSupabaseConfig } from "../lib/env";

/*
 * Shared settings and helpers for the browser tests.
 *
 * In local mode the accounts below exist only in the emulator's in-memory database, which is
 * recreated on every run; they are test values, not real credentials. In remote mode the
 * accounts come from E2E_* environment variables and must be dedicated test users.
 */
export const isRemote = Boolean(process.env.E2E_BASE_URL);

export const supabaseUrl = isRemote
  ? (readPublicSupabaseConfig(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)?.url ?? "")
  : `http://127.0.0.1:${process.env.LOCAL_SUPABASE_PORT ?? "54331"}`;

export const supabaseKey = isRemote
  ? (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "")
  : "local-emulator-publishable-key";

export type TestUser = { email: string; password: string };

export const userA: TestUser = {
  email: process.env.E2E_USER_EMAIL ?? "e2e-alice@lifeos.test",
  password: process.env.E2E_USER_PASSWORD ?? "Local-E2E-Alice-2026",
};

export const userB: TestUser = {
  email: process.env.E2E_USER2_EMAIL ?? "e2e-bob@lifeos.test",
  password: process.env.E2E_USER2_PASSWORD ?? "Local-E2E-Bob-2026",
};

/** Unique marker so tests never collide with each other or with real data. */
export function runTag(): string {
  return `e2e${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}

export async function signIn(page: Page, user: TestUser, next?: string): Promise<void> {
  await page.goto(next ? `/auth/login?next=${encodeURIComponent(next)}` : "/auth/login");
  await page.getByRole("textbox", { name: "Email" }).fill(user.email);
  await page.getByRole("textbox", { name: "Password" }).fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(next ? new RegExp(next.replace(/[?]/g, "\\?")) : /\/calendar/);
}

/** Signs in through the Auth API and returns an access token (for API-level checks). */
export async function apiToken(user: TestUser): Promise<string> {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: supabaseKey, "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });
  const body = (await response.json()) as { access_token?: string };
  if (!response.ok || !body.access_token) throw new Error(`API sign-in failed for ${user.email} (${response.status})`);
  return body.access_token;
}

/** Calls the Data API (PostgREST) as the user owning `token`. */
export async function rest(token: string, path: string, init: RequestInit = {}): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  return { status: response.status, body: text ? (JSON.parse(text) as unknown) : null };
}

/** Removes records a test created (matched by its unique tag). */
export async function cleanup(user: TestUser, tag: string): Promise<void> {
  const token = await apiToken(user);
  await rest(token, `activities?title=like.*${tag}*`, { method: "DELETE" });
  await rest(token, `transactions?description=like.*${tag}*`, { method: "DELETE" });
}

/** The day-detail panel of the calendar. */
export function dayPanel(page: Page) {
  return page.getByRole("region", { name: /^Details for/ });
}

export async function openCalendarOn(page: Page, date: string): Promise<void> {
  await page.goto(`/calendar?view=month&date=${date}`);
  await expect(dayPanel(page)).toBeVisible();
}
